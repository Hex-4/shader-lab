import type {
  ArtworkCanvas,
  ArtworkImageLayer,
  ArtworkLayer,
  ArtworkTextLayer,
} from "../types/artwork";
import type { ArtworkImageCache } from "./draw-artwork";
import { measureTextLayerPx } from "./text-layer";

export type ArtworkRect = {
  /** Normalized 0–1, origin top-left of artwork */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TransformableLayer = ArtworkTextLayer | ArtworkImageLayer;

export function isTransformableLayer(
  layer: ArtworkLayer,
): layer is TransformableLayer {
  return layer.type === "text" || layer.type === "image";
}

export { measureTextLayerPx } from "./text-layer";

export function measureImageLayerPx(
  canvas: ArtworkCanvas,
  layer: ArtworkImageLayer,
  imageCache?: ArtworkImageCache,
): { left: number; top: number; width: number; height: number } | null {
  const img = imageCache?.get(layer.src);
  if (!img) return null;

  const iw = "naturalWidth" in img ? img.naturalWidth : (img as HTMLImageElement).width;
  const ih = "naturalHeight" in img ? img.naturalHeight : (img as HTMLImageElement).height;
  if (!iw || !ih) return null;

  const { width, height } = canvas;
  const drawW = iw * layer.scale;
  const drawH = ih * layer.scale;
  const left = layer.x * width - drawW / 2;
  const top = (1 - layer.y) * height - drawH / 2;

  return { left, top, width: drawW, height: drawH };
}

export function pxRectToNormalized(
  rect: { left: number; top: number; width: number; height: number },
  canvas: ArtworkCanvas,
): ArtworkRect {
  return {
    x: rect.left / canvas.width,
    y: rect.top / canvas.height,
    width: rect.width / canvas.width,
    height: rect.height / canvas.height,
  };
}

export function measureLayerPx(
  ctx: CanvasRenderingContext2D,
  canvas: ArtworkCanvas,
  layer: TransformableLayer,
  imageCache?: ArtworkImageCache,
): { left: number; top: number; width: number; height: number } | null {
  if (layer.type === "text") {
    return measureTextLayerPx(ctx, canvas, layer);
  }
  return measureImageLayerPx(canvas, layer, imageCache);
}

export function hitTestPointInPxRect(
  px: number,
  py: number,
  rect: { left: number; top: number; width: number; height: number },
  padding = 6,
): boolean {
  return (
    px >= rect.left - padding
    && px <= rect.left + rect.width + padding
    && py >= rect.top - padding
    && py <= rect.top + rect.height + padding
  );
}

/** Top-most transformable layer at artwork-normalized point (x, y with y from bottom). */
export function pickTransformableLayer(
  ctx: CanvasRenderingContext2D,
  canvas: ArtworkCanvas,
  layers: ArtworkLayer[],
  normX: number,
  normY: number,
  imageCache?: ArtworkImageCache,
): TransformableLayer | null {
  const px = normX * canvas.width;
  const py = (1 - normY) * canvas.height;

  for (const layer of layers) {
    if (!layer.enabled || !isTransformableLayer(layer)) continue;
    if (layer.type === "image" && !layer.src) continue;

    const rect = measureLayerPx(ctx, canvas, layer, imageCache);
    if (rect && hitTestPointInPxRect(px, py, rect)) {
      return layer;
    }
  }
  return null;
}

export type HandleId = "nw" | "ne" | "sw" | "se";

/** Set layer anchor from a top-left pixel bounding box (move only; size unchanged). */
export function setLayerFromPxRect(
  ctx: CanvasRenderingContext2D,
  canvas: ArtworkCanvas,
  layer: TransformableLayer,
  rect: { left: number; top: number; width: number; height: number },
) {
  if (layer.type === "image") {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    layer.x = centerX / canvas.width;
    layer.y = 1 - centerY / canvas.height;
    return;
  }

  const measured = measureTextLayerPx(ctx, canvas, layer);

  const anchorY = rect.top + measured.height / 2;
  layer.y = 1 - anchorY / canvas.height;

  if (layer.align === "center") {
    layer.x = (rect.left + measured.width / 2) / canvas.width;
  } else if (layer.align === "right") {
    layer.x = (rect.left + measured.width) / canvas.width;
  } else {
    layer.x = rect.left / canvas.width;
  }
}

export function hitTestHandle(
  normRect: ArtworkRect,
  normX: number,
  normY: number,
  handleSizeNorm = 0.02,
): HandleId | null {
  const yTop = normRect.y;
  const yBottom = normRect.y + normRect.height;
  const xLeft = normRect.x;
  const xRight = normRect.x + normRect.width;
  const nx = normX;
  const ny = 1 - normY;

  const corners: { id: HandleId; x: number; y: number }[] = [
    { id: "nw", x: xLeft, y: yTop },
    { id: "ne", x: xRight, y: yTop },
    { id: "sw", x: xLeft, y: yBottom },
    { id: "se", x: xRight, y: yBottom },
  ];

  for (const c of corners) {
    if (
      Math.abs(nx - c.x) <= handleSizeNorm
      && Math.abs(ny - c.y) <= handleSizeNorm
    ) {
      return c.id;
    }
  }
  return null;
}
