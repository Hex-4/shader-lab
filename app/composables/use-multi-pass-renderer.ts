import * as THREE from "three";
import type { RenderPass, LayerType } from "#shared/types/editor";
import type { GradientStop } from "#shared/types";

// Layer fragment shaders (imported as strings via vite-plugin-glsl)
import gradientFrag from "#shared/shaders/layers/gradient.frag";
import solidFrag from "#shared/shaders/layers/solid.frag";
import noiseFrag from "#shared/shaders/layers/noise.frag";
import distortionFrag from "#shared/shaders/layers/distortion.frag";
import ditherFrag from "#shared/shaders/layers/dither.frag";
import grainFrag from "#shared/shaders/layers/grain.frag";
import vignetteFrag from "#shared/shaders/layers/vignette.frag";
import outputFrag from "#shared/shaders/layers/output.frag";
import fullscreenVert from "#shared/shaders/layers/fullscreen.vert";

const FRAG_SHADERS: Record<LayerType, string> = {
  gradient: gradientFrag,
  solid: solidFrag,
  noise: noiseFrag,
  distortion: distortionFrag,
  dither: ditherFrag,
  grain: grainFrag,
  vignette: vignetteFrag,
};

const GRADIENT_RESOLUTION = 256;

// ── Gradient texture helpers ────────────────────────────────────────

function hashGradientStops(stops: GradientStop[]): string {
  return stops
    .map((s) => `${s.color}@${s.position.toFixed(4)}`)
    .join("|");
}

function createGradientTexture(stops: GradientStop[]): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = GRADIENT_RESOLUTION;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;

  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const gradient = ctx.createLinearGradient(0, 0, GRADIENT_RESOLUTION, 0);
  for (const stop of sorted) {
    gradient.addColorStop(Math.max(0, Math.min(1, stop.position)), stop.color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GRADIENT_RESOLUTION, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function updateGradientTexture(
  texture: THREE.CanvasTexture,
  stops: GradientStop[],
) {
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;

  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const gradient = ctx.createLinearGradient(0, 0, GRADIENT_RESOLUTION, 0);
  for (const stop of sorted) {
    gradient.addColorStop(Math.max(0, Math.min(1, stop.position)), stop.color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GRADIENT_RESOLUTION, 1);
  texture.needsUpdate = true;
}

// ── Composable ──────────────────────────────────────────────────────

export function useMultiPassRenderer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  passes: Ref<RenderPass[]> | ComputedRef<RenderPass[]>,
  globalSpeed: Ref<number> = ref(1),
  paused: Ref<boolean> = ref(false),
) {
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let geometry: THREE.PlaneGeometry | null = null;
  let animationId: number | null = null;
  let accumulatedTime = 0;
  let lastFrameTime = 0;

  const renderTargets = new Map<string, THREE.WebGLRenderTarget>();
  const materials = new Map<string, THREE.ShaderMaterial>();

  // Cache gradient textures to avoid recreating every frame.
  // Keyed by a hash of the gradient stops.
  const gradientTextureCache = new Map<
    string,
    { hash: string; texture: THREE.CanvasTexture }
  >();

  // Track which shader type each material was built for, so we can detect
  // when a layer's type changes and recreate its material.
  const materialLayerTypes = new Map<string, LayerType>();

  // ── Gradient texture management ─────────────────────────────────

  function getOrUpdateGradientTexture(
    layerId: string,
    uniformName: string,
    stops: GradientStop[],
  ): THREE.CanvasTexture {
    const cacheKey = `${layerId}:${uniformName}`;
    const hash = hashGradientStops(stops);
    const cached = gradientTextureCache.get(cacheKey);

    if (cached && cached.hash === hash) {
      return cached.texture;
    }

    if (cached) {
      // Stops changed — update in place
      updateGradientTexture(cached.texture, stops);
      cached.hash = hash;
      return cached.texture;
    }

    // First time — create new
    const texture = createGradientTexture(stops);
    gradientTextureCache.set(cacheKey, { hash, texture });
    return texture;
  }

  // ── Build uniforms for a single pass ────────────────────────────

  function buildPassUniforms(
    pass: RenderPass,
    time: number,
    width: number,
    height: number,
    dpr: number,
  ): Record<string, { value: unknown }> {
    const uniforms: Record<string, { value: unknown }> = {
      u_time: { value: time },
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_scale: { value: dpr },
    };

    // Layer-specific uniforms
    for (const [key, val] of Object.entries(pass.uniforms)) {
      if (key === "u_gradient" && Array.isArray(val)) {
        uniforms[key] = {
          value: getOrUpdateGradientTexture(
            pass.layerId,
            key,
            val as GradientStop[],
          ),
        };
      } else if (key === "u_color" && typeof val === "string") {
        uniforms[key] = { value: new THREE.Color(val) };
      } else if (Array.isArray(val) && val.length === 2) {
        uniforms[key] = { value: new THREE.Vector2(val[0] as number, val[1] as number) };
      } else {
        uniforms[key] = { value: val };
      }
    }

    // Single input from previous layer
    if (pass.inputLayerId) {
      const inputRT = renderTargets.get(pass.inputLayerId);
      if (inputRT) {
        uniforms.u_input = { value: inputRT.texture };
      }
    }

    return uniforms;
  }

  // ── Core render loop ────────────────────────────────────────────

  function render() {
    if (!renderer || !scene || !camera || !geometry) return;

    const now = performance.now() / 1000;
    const delta = lastFrameTime === 0 ? 0 : now - lastFrameTime;
    lastFrameTime = now;

    if (!paused.value) {
      accumulatedTime += delta * globalSpeed.value;
    }

    const time = accumulatedTime;
    const dpr = window.devicePixelRatio || 1;
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;

    const currentPasses = passes.value;
    if (currentPasses.length === 0) return;

    for (const pass of currentPasses) {
      // Ensure render target exists for non-output passes
      if (!pass.isOutput) {
        let rt = renderTargets.get(pass.layerId);
        if (!rt) {
          rt = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            wrapS: THREE.MirroredRepeatWrapping,
            wrapT: THREE.MirroredRepeatWrapping,
          });
          rt.texture.wrapS = THREE.MirroredRepeatWrapping;
          rt.texture.wrapT = THREE.MirroredRepeatWrapping;
          renderTargets.set(pass.layerId, rt);
        }
      }

      const uniforms = buildPassUniforms(pass, time, width, height, dpr);

      // Get or create material (recreate if layer type changed)
      let material = materials.get(pass.layerId);
      const prevType = materialLayerTypes.get(pass.layerId);

      if (material && prevType !== pass.layerType) {
        // Layer type changed — dispose old material and recreate
        material.dispose();
        material = undefined;
        materials.delete(pass.layerId);
        materialLayerTypes.delete(pass.layerId);
      }

      const fragShader = pass.isOutput && !FRAG_SHADERS[pass.layerType]
        ? outputFrag
        : FRAG_SHADERS[pass.layerType];

      if (!material) {
        material = new THREE.ShaderMaterial({
          vertexShader: fullscreenVert,
          fragmentShader: fragShader,
          uniforms,
        });
        materials.set(pass.layerId, material);
        materialLayerTypes.set(pass.layerId, pass.layerType);
      } else {
        // Update existing uniforms in place
        for (const [key, entry] of Object.entries(uniforms)) {
          if (material.uniforms[key]) {
            material.uniforms[key].value = entry.value;
          } else {
            material.uniforms[key] = entry;
          }
        }
      }

      // Render this pass
      const mesh = new THREE.Mesh(geometry, material);
      scene.children.length = 0;
      scene.add(mesh);

      if (pass.isOutput) {
        renderer.setRenderTarget(null);
      } else {
        renderer.setRenderTarget(renderTargets.get(pass.layerId)!);
      }

      renderer.render(scene, camera);
    }

    // Always reset render target after all passes
    renderer.setRenderTarget(null);
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    render();
  }

  // ── Resize ──────────────────────────────────────────────────────

  function resize() {
    if (!renderer) return;

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    const width = renderer.domElement.width;
    const height = renderer.domElement.height;

    for (const rt of renderTargets.values()) {
      rt.setSize(width, height);
    }
  }

  // ── Init ────────────────────────────────────────────────────────

  function init() {
    const canvas = canvasRef.value;
    if (!canvas) return;

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    geometry = new THREE.PlaneGeometry(2, 2);

    animate();
    window.addEventListener("resize", resize);
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  function destroy() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    window.removeEventListener("resize", resize);

    // Dispose render targets
    for (const rt of renderTargets.values()) {
      rt.dispose();
    }
    renderTargets.clear();

    // Dispose materials
    for (const material of materials.values()) {
      material.dispose();
    }
    materials.clear();
    materialLayerTypes.clear();

    // Dispose cached gradient textures
    for (const { texture } of gradientTextureCache.values()) {
      texture.dispose();
    }
    gradientTextureCache.clear();

    // Dispose shared geometry
    geometry?.dispose();
    geometry = null;

    // Dispose renderer
    renderer?.dispose();
    renderer = null;
    scene = null;
    camera = null;
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  // Watch for canvas ref becoming available (needed because <ClientOnly>
  // defers rendering, so the canvas isn't in the DOM at onMounted time)
  watch(canvasRef, (canvas) => {
    if (canvas && !renderer) {
      init();
    }
  }, { immediate: true });

  onBeforeUnmount(destroy);

  return {
    pause: () => { paused.value = true; },
    resume: () => { paused.value = false; },
    getCanvas: (): HTMLCanvasElement | null => renderer?.domElement ?? null,
  };
}
