import type { ArtworkCanvas, ArtworkTextLayer } from "../types/artwork";

export type ArtworkTextRunStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
};

export type ArtworkTextRun = {
  text: string;
  style?: ArtworkTextRunStyle;
};

export const TEXT_FONT_FAMILIES = [
  { id: "Inter", label: "Inter" },
  { id: "system-ui", label: "System" },
  { id: "Georgia", label: "Georgia" },
  { id: "ui-monospace", label: "Mono" },
] as const;

export function textFontSizePx(layer: ArtworkTextLayer, canvasHeight: number) {
  return layer.fontSize * (canvasHeight / 1080);
}

export function textLineHeightPx(layer: ArtworkTextLayer, canvasHeight: number) {
  const size = textFontSizePx(layer, canvasHeight);
  return size * (layer.lineHeight ?? 1.25);
}

export function textLetterSpacingPx(layer: ArtworkTextLayer, canvasHeight: number) {
  return (layer.letterSpacing ?? 0) * (canvasHeight / 1080);
}

export function getTextRuns(layer: ArtworkTextLayer): ArtworkTextRun[] {
  if (layer.runs?.length) return layer.runs;
  return [{ text: layer.content ?? "" }];
}

export function flattenRuns(runs: ArtworkTextRun[]): string {
  return runs.map((r) => r.text).join("");
}

export function syncLayerTextContent(layer: ArtworkTextLayer) {
  layer.content = flattenRuns(getTextRuns(layer));
}

export function setLayerRuns(layer: ArtworkTextLayer, runs: ArtworkTextRun[]) {
  layer.runs = runs.length ? runs : [{ text: "" }];
  syncLayerTextContent(layer);
}

function runFont(
  layer: ArtworkTextLayer,
  run: ArtworkTextRun,
  sizePx: number,
): string {
  const s = run.style;
  const weight = s?.bold ? 700 : (layer.fontWeight ?? 400);
  const style = s?.italic ? "italic" : (layer.fontStyle ?? "normal");
  return `${style} ${weight} ${sizePx}px ${layer.fontFamily}, system-ui, sans-serif`;
}

function measureRunWidth(
  ctx: CanvasRenderingContext2D,
  layer: ArtworkTextLayer,
  run: ArtworkTextRun,
  sizePx: number,
  letterSpacingPx: number,
): number {
  ctx.font = runFont(layer, run, sizePx);
  let w = 0;
  for (const ch of run.text) {
    w += ctx.measureText(ch).width + letterSpacingPx;
  }
  return Math.max(0, w - (run.text.length ? letterSpacingPx : 0));
}

export function stylesEqual(a?: ArtworkTextRunStyle, b?: ArtworkTextRunStyle) {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

export function measureLineWidth(
  ctx: CanvasRenderingContext2D,
  layer: ArtworkTextLayer,
  lineRuns: ArtworkTextRun[],
  sizePx: number,
  letterSpacingPx: number,
): number {
  return lineRuns.reduce(
    (sum, run) => sum + measureRunWidth(ctx, layer, run, sizePx, letterSpacingPx),
    0,
  );
}

/** Split runs into lines by newline characters (runs may span lines). */
export function splitRunsIntoLines(runs: ArtworkTextRun[]): ArtworkTextRun[][] {
  const lines: ArtworkTextRun[][] = [[]];

  function pushChunk(line: ArtworkTextRun[], chunk: string, style?: ArtworkTextRunStyle) {
    if (!chunk) return;
    const last = line[line.length - 1];
    if (last && stylesEqual(last.style, style)) {
      last.text += chunk;
    } else {
      line.push({ text: chunk, style: style ? { ...style } : undefined });
    }
  }

  for (const run of runs) {
    let buf = "";
    for (const ch of run.text) {
      if (ch === "\n") {
        pushChunk(lines[lines.length - 1]!, buf, run.style);
        buf = "";
        lines.push([]);
      } else {
        buf += ch;
      }
    }
    pushChunk(lines[lines.length - 1]!, buf, run.style);
  }

  return lines.length ? lines : [[]];
}

export function measureTextLayerPx(
  ctx: CanvasRenderingContext2D,
  canvas: ArtworkCanvas,
  layer: ArtworkTextLayer,
): { left: number; top: number; width: number; height: number } {
  const { width, height } = canvas;
  const sizePx = textFontSizePx(layer, height);
  const lineH = textLineHeightPx(layer, height);
  const letterSpacingPx = textLetterSpacingPx(layer, height);
  const lines = splitRunsIntoLines(getTextRuns(layer));

  let textW = 0;
  for (const line of lines) {
    textW = Math.max(textW, measureLineWidth(ctx, layer, line, sizePx, letterSpacingPx));
  }
  textW = Math.max(textW, sizePx * 0.25);

  const textH = Math.max(lineH, lines.length * lineH);

  const anchorX = layer.x * width;
  const anchorY = (1 - layer.y) * height;

  let left = anchorX;
  if (layer.align === "center") left = anchorX - textW / 2;
  else if (layer.align === "right") left = anchorX - textW;

  const top = anchorY - textH / 2;

  return { left, top, width: textW, height: textH };
}

function drawRunText(
  ctx: CanvasRenderingContext2D,
  layer: ArtworkTextLayer,
  run: ArtworkTextRun,
  x: number,
  y: number,
  sizePx: number,
  letterSpacingPx: number,
) {
  const color = run.style?.color ?? layer.color;
  ctx.fillStyle = color;
  ctx.font = runFont(layer, run, sizePx);

  let cx = x;
  for (const ch of run.text) {
    ctx.fillText(ch, cx, y);
    if (run.style?.underline) {
      const w = ctx.measureText(ch).width;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, sizePx * 0.06);
      ctx.beginPath();
      ctx.moveTo(cx, y + sizePx * 0.15);
      ctx.lineTo(cx + w, y + sizePx * 0.15);
      ctx.stroke();
    }
    cx += ctx.measureText(ch).width + letterSpacingPx;
  }
}

export function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layer: ArtworkTextLayer,
) {
  const sizePx = textFontSizePx(layer, height);
  const lineH = textLineHeightPx(layer, height);
  const letterSpacingPx = textLetterSpacingPx(layer, height);
  const lines = splitRunsIntoLines(getTextRuns(layer));
  const block = measureTextLayerPx(ctx, { width, height }, layer);

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.textBaseline = "middle";

  lines.forEach((lineRuns, lineIndex) => {
    const lineW = measureLineWidth(ctx, layer, lineRuns, sizePx, letterSpacingPx);
    let x = block.left;
    if (layer.align === "center") x = block.left + (block.width - lineW) / 2;
    else if (layer.align === "right") x = block.left + block.width - lineW;

    const y = block.top + lineH * (lineIndex + 0.5);

    for (const run of lineRuns) {
      drawRunText(ctx, layer, run, x, y, sizePx, letterSpacingPx);
      x += measureRunWidth(ctx, layer, run, sizePx, letterSpacingPx);
    }
  });

  ctx.restore();
}

export function applyStyleToRange(
  runs: ArtworkTextRun[],
  start: number,
  end: number,
  patch: ArtworkTextRunStyle,
): ArtworkTextRun[] {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(flattenRuns(runs).length, Math.max(start, end));
  if (lo >= hi) return runs;

  const out: ArtworkTextRun[] = [];
  let index = 0;

  for (const run of runs) {
    const runStart = index;
    const runEnd = index + run.text.length;
    index = runEnd;

    if (runEnd <= lo || runStart >= hi) {
      out.push(run);
      continue;
    }

    const beforeLen = Math.max(0, lo - runStart);
    const afterStart = Math.min(run.text.length, hi - runStart);
    const text = run.text;

    if (beforeLen > 0) {
      out.push({ text: text.slice(0, beforeLen), style: run.style });
    }

    const mid = text.slice(beforeLen, afterStart);
    if (mid.length > 0) {
      out.push({
        text: mid,
        style: { ...run.style, ...patch },
      });
    }

    if (afterStart < text.length) {
      out.push({ text: text.slice(afterStart), style: run.style });
    }
  }

  return mergeAdjacentRuns(out);
}

function mergeAdjacentRuns(runs: ArtworkTextRun[]): ArtworkTextRun[] {
  const out: ArtworkTextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = out[out.length - 1];
    if (prev && stylesEqual(prev.style, run.style)) {
      prev.text += run.text;
    } else {
      out.push({ text: run.text, style: run.style });
    }
  }
  return out.length ? out : [{ text: "" }];
}

export function parseEditorElement(
  root: HTMLElement,
  layer: ArtworkTextLayer,
): ArtworkTextRun[] {
  const runs: ArtworkTextRun[] = [];

  function styleFromElement(el: HTMLElement): ArtworkTextRunStyle | undefined {
    const style: ArtworkTextRunStyle = {};
    const weight = el.style.fontWeight || window.getComputedStyle(el).fontWeight;
    if (weight === "bold" || Number(weight) >= 600) style.bold = true;
    if ((el.style.fontStyle || window.getComputedStyle(el).fontStyle) === "italic") {
      style.italic = true;
    }
    if ((el.style.textDecoration || window.getComputedStyle(el).textDecoration).includes("underline")) {
      style.underline = true;
    }
    const color = el.style.color || window.getComputedStyle(el).color;
    if (color && color !== layer.color) style.color = color;
    return Object.keys(style).length ? style : undefined;
  }

  function walk(node: Node, inherited?: ArtworkTextRunStyle) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) runs.push({ text, style: inherited });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    if (el.tagName === "BR") {
      runs.push({ text: "\n", style: inherited });
      return;
    }

    const style = styleFromElement(el) ?? inherited;
    for (const child of el.childNodes) walk(child, style);
  }

  for (const child of root.childNodes) walk(child);
  return mergeAdjacentRuns(runs);
}

export function runsToEditorHtml(layer: ArtworkTextLayer, runs: ArtworkTextRun[]): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return runs
    .map((run) => {
      const text = escape(run.text).replace(/\n/g, "<br>");
      const s = run.style;
      if (!s || (!s.bold && !s.italic && !s.underline && !s.color)) {
        return text;
      }
      const css: string[] = [];
      if (s.bold) css.push("font-weight:700");
      if (s.italic) css.push("font-style:italic");
      if (s.underline) css.push("text-decoration:underline");
      if (s.color) css.push(`color:${s.color}`);
      return `<span style="${css.join(";")}">${text}</span>`;
    })
    .join("");
}

export function editorStyleFromLayer(
  layer: ArtworkTextLayer,
  canvasHeight: number,
  /** Stage display height / artwork canvas height */
  displayScale = 1,
): Record<string, string> {
  const sizePx = textFontSizePx(layer, canvasHeight) * displayScale;
  const lineH = textLineHeightPx(layer, canvasHeight) * displayScale;
  const letterSpacingPx = textLetterSpacingPx(layer, canvasHeight) * displayScale;

  return {
    fontFamily: `${layer.fontFamily}, system-ui, sans-serif`,
    fontSize: `${sizePx}px`,
    fontWeight: String(layer.fontWeight ?? 400),
    fontStyle: layer.fontStyle ?? "normal",
    lineHeight: `${lineH}px`,
    letterSpacing: `${letterSpacingPx}px`,
    color: layer.color,
    textAlign: layer.align,
    whiteSpace: "pre",
    width: "max-content",
    maxWidth: "none",
    overflow: "visible",
    padding: "0",
    margin: "0",
    border: "none",
    background: "transparent",
    outline: "none",
    boxSizing: "border-box",
  };
}

/** CSS % position for inline editor (top-left of text block, no fixed width). */
export function textEditorAnchorStyle(
  layer: ArtworkTextLayer,
  canvas: ArtworkCanvas,
  ctx: CanvasRenderingContext2D,
): Record<string, string> {
  const px = measureTextLayerPx(ctx, canvas, layer);
  return {
    left: `${(px.left / canvas.width) * 100}%`,
    top: `${(px.top / canvas.height) * 100}%`,
  };
}
