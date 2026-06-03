import type { ArtworkCanvas } from "../types/artwork";

export type PxRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SnapGuide = {
  axis: "x" | "y";
  position: number;
};

export type DistanceLabel = {
  axis: "x" | "y";
  from: number;
  to: number;
  cross: number;
  value: number;
};

export type SnapOverlay = {
  guides: SnapGuide[];
  distances: DistanceLabel[];
};

const DEFAULT_SNAP_THRESHOLD = 8;
const MAX_GAP_LABEL_PX = 200;

export function buildSnapTargets(
  canvas: ArtworkCanvas,
  layerRects: { id: string; rect: PxRect }[],
  excludeId: string,
): { x: number[]; y: number[] } {
  const x = new Set<number>([0, canvas.width / 2, canvas.width]);
  const y = new Set<number>([0, canvas.height / 2, canvas.height]);

  for (const { id, rect } of layerRects) {
    if (id === excludeId) continue;
    x.add(rect.left);
    x.add(rect.left + rect.width);
    x.add(rect.left + rect.width / 2);
    y.add(rect.top);
    y.add(rect.top + rect.height);
    y.add(rect.top + rect.height / 2);
  }

  return {
    x: [...x].sort((a, b) => a - b),
    y: [...y].sort((a, b) => a - b),
  };
}

function bestAxisSnap(
  edges: number[],
  targets: number[],
  threshold: number,
): { delta: number; guide: number | null } {
  let best: { delta: number; guide: number } | null = null;

  for (const edge of edges) {
    for (const target of targets) {
      const delta = target - edge;
      if (Math.abs(delta) > threshold) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) {
        best = { delta, guide: target };
      }
    }
  }

  if (!best) return { delta: 0, guide: null };
  return best;
}

export function snapPxRect(
  rect: PxRect,
  targets: { x: number[]; y: number[] },
  threshold = DEFAULT_SNAP_THRESHOLD,
): { rect: PxRect; guides: SnapGuide[] } {
  const left = rect.left;
  const right = rect.left + rect.width;
  const cx = rect.left + rect.width / 2;
  const top = rect.top;
  const bottom = rect.top + rect.height;
  const cy = rect.top + rect.height / 2;

  const xSnap = bestAxisSnap([left, right, cx], targets.x, threshold);
  const ySnap = bestAxisSnap([top, bottom, cy], targets.y, threshold);

  const guides: SnapGuide[] = [];
  if (xSnap.guide !== null) guides.push({ axis: "x", position: xSnap.guide });
  if (ySnap.guide !== null) guides.push({ axis: "y", position: ySnap.guide });

  return {
    rect: {
      left: rect.left + xSnap.delta,
      top: rect.top + ySnap.delta,
      width: rect.width,
      height: rect.height,
    },
    guides,
  };
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && a1 > b0;
}

export function computeDistanceLabels(
  rect: PxRect,
  canvas: ArtworkCanvas,
  otherRects: PxRect[],
): DistanceLabel[] {
  const labels: DistanceLabel[] = [];
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const midY = rect.top + rect.height / 2;
  const midX = rect.left + rect.width / 2;

  if (rect.left > 0.5) {
    labels.push({ axis: "x", from: 0, to: rect.left, cross: midY, value: rect.left });
  }
  if (right < canvas.width - 0.5) {
    labels.push({
      axis: "x",
      from: right,
      to: canvas.width,
      cross: midY,
      value: canvas.width - right,
    });
  }
  if (rect.top > 0.5) {
    labels.push({ axis: "y", from: 0, to: rect.top, cross: midX, value: rect.top });
  }
  if (bottom < canvas.height - 0.5) {
    labels.push({
      axis: "y",
      from: bottom,
      to: canvas.height,
      cross: midX,
      value: canvas.height - bottom,
    });
  }

  for (const o of otherRects) {
    const oRight = o.left + o.width;
    const oBottom = o.top + o.height;

    if (rangesOverlap(rect.top, bottom, o.top, oBottom)) {
      if (oRight <= rect.left) {
        const gap = rect.left - oRight;
        if (gap <= MAX_GAP_LABEL_PX) {
          labels.push({
            axis: "x",
            from: oRight,
            to: rect.left,
            cross: (Math.max(rect.top, o.top) + Math.min(bottom, oBottom)) / 2,
            value: gap,
          });
        }
      } else if (right <= o.left) {
        const gap = o.left - right;
        if (gap <= MAX_GAP_LABEL_PX) {
          labels.push({
            axis: "x",
            from: right,
            to: o.left,
            cross: (Math.max(rect.top, o.top) + Math.min(bottom, oBottom)) / 2,
            value: gap,
          });
        }
      }
    }

    if (rangesOverlap(rect.left, right, o.left, oRight)) {
      if (oBottom <= rect.top) {
        const gap = rect.top - oBottom;
        if (gap <= MAX_GAP_LABEL_PX) {
          labels.push({
            axis: "y",
            from: oBottom,
            to: rect.top,
            cross: (Math.max(rect.left, o.left) + Math.min(right, oRight)) / 2,
            value: gap,
          });
        }
      } else if (bottom <= o.top) {
        const gap = o.top - bottom;
        if (gap <= MAX_GAP_LABEL_PX) {
          labels.push({
            axis: "y",
            from: bottom,
            to: o.top,
            cross: (Math.max(rect.left, o.left) + Math.min(right, oRight)) / 2,
            value: gap,
          });
        }
      }
    }
  }

  return labels;
}

export function applySnapToRect(
  rect: PxRect,
  canvas: ArtworkCanvas,
  layerRects: { id: string; rect: PxRect }[],
  excludeId: string,
  threshold = DEFAULT_SNAP_THRESHOLD,
): SnapOverlay & { rect: PxRect } {
  const targets = buildSnapTargets(canvas, layerRects, excludeId);
  const { rect: snapped, guides } = snapPxRect(rect, targets, threshold);
  const others = layerRects.filter((l) => l.id !== excludeId).map((l) => l.rect);
  const distances = computeDistanceLabels(snapped, canvas, others);
  return { rect: snapped, guides, distances };
}

export function pxToPercent(
  value: number,
  canvasSize: number,
): string {
  return `${(value / canvasSize) * 100}%`;
}
