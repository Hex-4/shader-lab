import type { ArtworkDocument, ArtworkLayer, ArtworkTextLayer } from "../types/artwork";

/** Draw artwork design layers (text/image) on top of an existing background. */
export function drawArtworkLayers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layers: ArtworkLayer[],
) {
  const enabled = [...layers].reverse().filter((l) => l.enabled);

  for (const layer of enabled) {
    if (layer.type === "text") {
      drawTextLayer(ctx, width, height, layer);
    } else if (layer.type === "image" && layer.src) {
      // Images loaded externally and passed via cache in composable
    }
  }
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layer: ArtworkTextLayer,
) {
  const x = layer.x * width;
  const y = (1 - layer.y) * height;
  const size = layer.fontSize * (height / 1080);

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.fillStyle = layer.color;
  ctx.font = `${size}px ${layer.fontFamily}, system-ui, sans-serif`;
  ctx.textBaseline = "middle";

  if (layer.align === "center") {
    ctx.textAlign = "center";
    ctx.fillText(layer.content, x, y);
  } else if (layer.align === "right") {
    ctx.textAlign = "right";
    ctx.fillText(layer.content, x, y);
  } else {
    ctx.textAlign = "left";
    ctx.fillText(layer.content, x, y);
  }

  ctx.restore();
}

export function defaultArtworkDocument(canvas = { width: 1080, height: 1080 }): ArtworkDocument {
  return { version: 1, canvas, layers: [] };
}
