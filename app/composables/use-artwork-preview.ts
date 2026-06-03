import type { ArtworkDocument } from "#shared/types/artwork";
import type { LayerInstance, LFOSource, ModulationAssignment } from "#shared/types/editor";
import { drawArtworkLayers, type ArtworkImageCache } from "#shared/artwork/draw-artwork";

/**
 * Composites linked shader(s) + text/image layers into a display canvas.
 */
export function useArtworkPreview(
  displayCanvasRef: Ref<HTMLCanvasElement | null>,
  artwork: Ref<ArtworkDocument>,
  shaderCache: Ref<Record<string, { layers: LayerInstance[]; lfos: LFOSource[]; assignments: ModulationAssignment[] }>>,
  hideTextLayerId?: Ref<string | null>,
) {
  const offscreenShaderCanvas = ref<HTMLCanvasElement | null>(null);
  const activeShaderCanvasRef = computed(() => offscreenShaderCanvas.value);

  const shaderBufferSize = computed(() => artwork.value.canvas);

  const shaderLayers = computed(() => artwork.value.layers.filter((l) => l.type === "shader" && l.enabled));

  const primaryShader = computed(() => {
    const layer = shaderLayers.value[0];
    if (!layer || layer.type !== "shader" || layer.shaderId === "__pending__") return null;
    return shaderCache.value[layer.shaderId] ?? null;
  });

  const layersRef = computed(() => primaryShader.value?.layers ?? []);
  const lfosRef = computed(() => primaryShader.value?.lfos ?? []);
  const assignmentsRef = computed(() => primaryShader.value?.assignments ?? []);

  const { getModulatedValue, sampleLfosAtTime } = useModulationEngine(lfosRef, assignmentsRef);
  const modFn = computed(() => getModulatedValue);
  const { passes } = useLayerCompiler(layersRef, modFn, lfosRef, assignmentsRef);

  const rendererControls = useMultiPassRenderer(activeShaderCanvasRef, passes, {
    layers: layersRef,
    getModulatedValue: modFn,
    sampleLfosAtTime,
    fixedBufferSize: shaderBufferSize,
  });

  const imageCache = ref<ArtworkImageCache>(new Map());

  async function loadArtworkImages() {
    if (import.meta.server) return;

    const cache = new Map(imageCache.value);
    for (const layer of artwork.value.layers) {
      if (layer.type === "image" && layer.src && !cache.has(layer.src)) {
        await new Promise<void>((resolve) => {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            cache.set(layer.src, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = layer.src;
        });
      }
    }
    imageCache.value = cache;
  }

  watch(
    () => artwork.value.layers.map((l) => (l.type === "image" ? l.src : "")).join("|"),
    () => loadArtworkImages(),
    { immediate: import.meta.client },
  );

  onMounted(() => {
    offscreenShaderCanvas.value = document.createElement("canvas");
  });

  onUnmounted(() => {
    offscreenShaderCanvas.value = null;
  });

  function resizeDisplayCanvas() {
    const display = displayCanvasRef.value;
    if (!display) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = display.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));

    if (display.width !== w || display.height !== h) {
      display.width = w;
      display.height = h;
    }
  }

  let frameId: number | null = null;

  function composite() {
    resizeDisplayCanvas();
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

    if (off && primaryShader.value && passes.value.length > 0) {
      ctx.drawImage(off, 0, 0, dw, dh);
    }

    ctx.save();
    ctx.scale(dw / width, dh / height);
    const skipId = hideTextLayerId?.value ?? null;
    const layers = skipId
      ? artwork.value.layers.filter((l) => l.id !== skipId)
      : artwork.value.layers;
    drawArtworkLayers(ctx, width, height, layers, imageCache.value);
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

  watch(
    [displayCanvasRef, artwork, shaderCache, passes, primaryShader],
    () => nextTick(start),
    { deep: true },
  );

  onMounted(() => start());
  onUnmounted(() => stop());

  return {
    getDisplayCanvas: () => displayCanvasRef.value,
    rendererControls,
    sampleLfosAtTime,
    imageCache,
    loadArtworkImages,
  };
}
