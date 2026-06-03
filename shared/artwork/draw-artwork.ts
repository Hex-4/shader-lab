import type { ArtworkDocument, ArtworkLayer, ArtworkImageLayer } from "../types/artwork";
import { drawTextLayer } from "./text-layer";

export type ArtworkImageCache = Map<string, CanvasImageSource>;

export function scaledImageBorderRadius(
  borderRadius: number | undefined,
  canvasHeight: number,
  drawW: number,
  drawH: number,
): number {
  const r = (borderRadius ?? 0) * (canvasHeight / 1080);
  return Math.max(0, Math.min(r, drawW / 2, drawH / 2));
}

/** Draw artwork design layers (text/image) on top of an existing background. */
export function drawArtworkLayers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layers: ArtworkLayer[],
  imageCache?: ArtworkImageCache,
) {
  const enabled = [...layers].reverse().filter((l) => l.enabled);

  for (const layer of enabled) {
    if (layer.type === "text") {
      drawTextLayer(ctx, width, height, layer);
    } else if (layer.type === "image" && layer.src) {
      drawImageLayer(ctx, width, height, layer, imageCache);
    }
  }
}

function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layer: ArtworkImageLayer,
  imageCache?: ArtworkImageCache,
) {
  const img = imageCache?.get(layer.src);
  if (!img) return;

  const iw = "naturalWidth" in img ? img.naturalWidth : (img as HTMLImageElement).width;
  const ih = "naturalHeight" in img ? img.naturalHeight : (img as HTMLImageElement).height;
  if (!iw || !ih) return;

  const drawW = iw * layer.scale;
  const drawH = ih * layer.scale;
  const x = layer.x * width - drawW / 2;
  const y = (1 - layer.y) * height - drawH / 2;

  const radius = scaledImageBorderRadius(layer.borderRadius, height, drawW, drawH);

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  if (radius > 0) {
    ctx.beginPath();
    ctx.roundRect(x, y, drawW, drawH, radius);
    ctx.clip();
  }
  ctx.drawImage(img, x, y, drawW, drawH);
  ctx.restore();
}

export function defaultArtworkDocument(canvas = { width: 1080, height: 1080 }): ArtworkDocument {
  return { version: 1, canvas, layers: [] };
}
