import type { ArtworkDocument, ArtworkLayer } from "#shared/types/artwork";
import type { LayerInstance, LFOSource, ModulationAssignment } from "#shared/types/editor";
import { drawArtworkLayers } from "#shared/artwork/draw-artwork";
import { compilePasses } from "#shared/editor/compile-passes";

/**
 * Composites linked shader(s) + text/image layers into a display canvas.
 */
export function useArtworkPreview(
  displayCanvasRef: Ref<HTMLCanvasElement | null>,
  artwork: Ref<ArtworkDocument>,
  shaderCache: Ref<Record<string, { layers: LayerInstance[]; lfos: LFOSource[]; assignments: ModulationAssignment[] }>>,
) {
  const offscreenShaderCanvas = ref<HTMLCanvasElement | null>(null);
  const activeShaderCanvasRef = computed(() => offscreenShaderCanvas.value);

  const shaderLayers = computed(() => artwork.value.layers.filter((l) => l.type === "shader" && l.enabled));

  const primaryShader = computed(() => {
    const layer = shaderLayers.value[0];
    if (!layer || layer.type !== "shader" || layer.shaderId === "__pending__") return null;
    return shaderCache.value[layer.shaderId] ?? null;
  });

  const layersRef = computed(() => primaryShader.value?.layers ?? []);
  const lfosRef = computed(() => primaryShader.value?.lfos ?? []);
  const assignmentsRef = computed(() => primaryShader.value?.assignments ?? []);

  const { getModulatedValue } = useModulationEngine(lfosRef, assignmentsRef);
  const modFn = computed(() => getModulatedValue);
  const { passes } = useLayerCompiler(layersRef, modFn, lfosRef, assignmentsRef);

  useMultiPassRenderer(activeShaderCanvasRef, passes, {
    layers: layersRef,
    getModulatedValue: modFn,
  });

  onMounted(() => {
    const c = document.createElement("canvas");
    offscreenShaderCanvas.value = c;
  });

  onUnmounted(() => {
    offscreenShaderCanvas.value = null;
  });

  function resizeCanvases() {
    const display = displayCanvasRef.value;
    if (!display) return;

    const { width, height } = artwork.value.canvas;
    const dpr = window.devicePixelRatio || 1;
    const rect = display.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));

    if (display.width !== w || display.height !== h) {
      display.width = w;
      display.height = h;
    }

    const off = offscreenShaderCanvas.value;
    if (off) {
      off.width = width;
      off.height = height;
    }
  }

  let frameId: number | null = null;

  function composite() {
    resizeCanvases();
    const display = displayCanvasRef.value;
    const off = offscreenShaderCanvas.value;
    if (!display) return;

    const ctx = display.getContext("2d");
    if (!ctx) return;

    const dw = display.width;
    const dh = display.height;
    const { width, height } = artwork.value.canvas;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, dw, dh);

    if (off && primaryShader.value) {
      ctx.drawImage(off, 0, 0, dw, dh);
    }

    ctx.save();
    ctx.scale(dw / width, dh / height);
    drawArtworkLayers(ctx, width, height, artwork.value.layers);
    ctx.restore();
  }

  function start() {
    function loop() {
      composite();
      frameId = requestAnimationFrame(loop);
    }
    if (frameId === null) {
      frameId = requestAnimationFrame(loop);
    }
  }

  function stop() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  watch([displayCanvasRef, artwork, shaderCache, passes], () => {
    nextTick(start);
  }, { deep: true });

  onMounted(() => start());
  onUnmounted(() => stop());

  return {
    getDisplayCanvas: () => displayCanvasRef.value,
  };
}
