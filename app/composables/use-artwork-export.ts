import type { ArtworkDocument } from "#shared/types/artwork";
import type { LayerInstance, LFOSource, ModulationAssignment } from "#shared/types/editor";
import { drawArtworkLayers, type ArtworkImageCache } from "#shared/artwork/draw-artwork";

type ShaderCache = Record<string, {
  layers: LayerInstance[];
  lfos: LFOSource[];
  assignments: ModulationAssignment[];
}>;

type ExportControls = {
  pause: () => void;
  resume: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  configureRenderer: (width: number, height: number) => void;
  restoreRenderer: () => void;
  renderFrame: (time: number) => void;
};

export function useArtworkExport(
  artwork: Ref<ArtworkDocument>,
  shaderCache: Ref<ShaderCache>,
  shaderControls: ExportControls,
  sampleLfosAtTime: (time: number) => void,
) {
  const imageCache = ref<ArtworkImageCache>(new Map());

  async function ensureImagesLoaded() {
    const cache = new Map(imageCache.value);
    for (const layer of artwork.value.layers) {
      if (layer.type === "image" && layer.src && !cache.has(layer.src)) {
        await new Promise<void>((resolve) => {
          const img = new Image();
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

  async function compositeToCanvas(
    target: HTMLCanvasElement,
    shaderCanvas: HTMLCanvasElement | null,
  ) {
    const { width, height } = artwork.value.canvas;
    target.width = width;
    target.height = height;
    const ctx = target.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    if (shaderCanvas) {
      ctx.drawImage(shaderCanvas, 0, 0, width, height);
    }

    drawArtworkLayers(ctx, width, height, artwork.value.layers, imageCache.value);
  }

  async function capturePng(exportWidth: number, exportHeight: number, filename: string) {
    await ensureImagesLoaded();

    const { width, height } = artwork.value.canvas;
    const scaleX = exportWidth / width;
    const scaleY = exportHeight / height;

    shaderControls.pause();
    shaderControls.configureRenderer(width, height);
    shaderControls.renderFrame(performance.now() / 1000);

    const shaderCanvas = shaderControls.getCanvas();
    const composite = document.createElement("canvas");
    composite.width = width;
    composite.height = height;
    await compositeToCanvas(composite, shaderCanvas);

    shaderControls.restoreRenderer();
    shaderControls.resume();

    const out = document.createElement("canvas");
    out.width = exportWidth;
    out.height = exportHeight;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(composite, 0, 0, exportWidth, exportHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      out.toBlob(resolve, "image/png");
    });
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const videoCanvas = ref<HTMLCanvasElement | null>(null);

  onMounted(() => {
    videoCanvas.value = document.createElement("canvas");
  });

  onUnmounted(() => {
    videoCanvas.value = null;
  });

  function compositeFrameSync(time: number, outWidth: number, outHeight: number) {
    sampleLfosAtTime(time);
    shaderControls.renderFrame(time);
    const vc = videoCanvas.value;
    if (!vc) return;

    const { width, height } = artwork.value.canvas;
    const composite = document.createElement("canvas");
    composite.width = width;
    composite.height = height;
    const ctx = composite.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);
    const shaderCanvas = shaderControls.getCanvas();
    if (shaderCanvas) {
      ctx.drawImage(shaderCanvas, 0, 0, width, height);
    }
    drawArtworkLayers(ctx, width, height, artwork.value.layers, imageCache.value);

    const vctx = vc.getContext("2d");
    if (!vctx) return;
    vctx.drawImage(composite, 0, 0, outWidth, outHeight);
  }

  function getExportControls(artifactId: string): ExportControls & { capture: (w: number, h: number) => Promise<void> } {
    let outW = artwork.value.canvas.width;
    let outH = artwork.value.canvas.height;

    return {
      pause: () => shaderControls.pause(),
      resume: () => shaderControls.resume(),
      configureRenderer: (w, h) => {
        outW = w;
        outH = h;
        const { width, height } = artwork.value.canvas;
        shaderControls.configureRenderer(width, height);
        if (videoCanvas.value) {
          videoCanvas.value.width = w;
          videoCanvas.value.height = h;
        }
      },
      restoreRenderer: () => shaderControls.restoreRenderer(),
      getCanvas: () => videoCanvas.value,
      renderFrame: (time: number) => compositeFrameSync(time, outW, outH),
      capture: async (w: number, h: number) => {
        await ensureImagesLoaded();
        await capturePng(w, h, `${artifactId}-${w}x${h}.png`);
      },
    };
  }

  return {
    capturePng,
    getExportControls,
    ensureImagesLoaded,
  };
}
