<script setup lang="ts">
import type { WavePoint } from "#shared/types/editor";
import { evaluateWavePoints, getOnCurveY, curveFromOnCurveY } from "~/composables/use-modulation-engine";

type Props = {
  color: string;
  cursorPosition?: number;
};

const { color, cursorPosition } = defineProps<Props>();

const points = defineModel<WavePoint[]>({ required: true });

const canvasRef = ref<HTMLCanvasElement | null>(null);

// Interaction state
const hoveredIdx = ref<number | null>(null);
const hoveredType = ref<"anchor" | "curve" | null>(null);
const dragIdx = ref<number | null>(null);
const dragType = ref<"anchor" | "curve" | null>(null);

const ANCHOR_RADIUS = 4;
const CURVE_RADIUS = 3;
const HIT_RADIUS = 12;

// --- Coordinate mapping ---

function toCanvasX(x: number, w: number, pad: number): number {
  return pad + x * (w - pad * 2);
}

function toCanvasY(y: number, h: number, pad: number): number {
  return pad + (1 - y) * (h - pad * 2);
}

function fromCanvasX(cx: number, w: number, pad: number): number {
  return Math.max(0, Math.min(1, (cx - pad) / (w - pad * 2)));
}

function fromCanvasY(cy: number, h: number, pad: number): number {
  return Math.max(0, Math.min(1, 1 - (cy - pad) / (h - pad * 2)));
}

// --- On-curve control point position (what user sees/drags) ---

function getCurveHandlePos(i: number, w: number, h: number, pad: number): { x: number; y: number } {
  const p1 = points.value[i]!;
  const p2 = points.value[i + 1];
  if (!p2) return { x: 0, y: 0 };

  const midX = (p1.x + p2.x) / 2;
  const onCurve = getOnCurveY(p1.y, p2.y, p1.curve);

  return {
    x: toCanvasX(midX, w, pad),
    y: toCanvasY(onCurve, h, pad),
  };
}

// --- Drawing ---

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width * dpr;
  const h = rect.height * dpr;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);

  const pad = 10 * dpr;
  const pts = points.value;

  // Grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = dpr;
  for (const gy of [0, 0.25, 0.5, 0.75, 1]) {
    const y = toCanvasY(gy, h, pad);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }

  // Draw wave curve — segment by segment for correct vertical lines
  if (pts.length >= 2) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5 * dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    // Start at first point
    ctx.moveTo(toCanvasX(pts[0]!.x, w, pad), toCanvasY(pts[0]!.y, h, pad));

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i]!;
      const p2 = pts[i + 1]!;

      if (Math.abs(p2.x - p1.x) < 0.001) {
        // Zero-width segment: draw vertical line directly
        ctx.lineTo(toCanvasX(p2.x, w, pad), toCanvasY(p2.y, h, pad));
      } else {
        // Sample the segment curve
        const segSteps = Math.max(20, Math.floor((p2.x - p1.x) * w));
        for (let s = 1; s <= segSteps; s++) {
          const segT = s / segSteps;
          const t = p1.x + segT * (p2.x - p1.x);
          const y = evaluateWavePoints(pts, t);
          ctx.lineTo(toCanvasX(t, w, pad), toCanvasY(y, h, pad));
        }
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Cursor
  if (cursorPosition != null) {
    const cx = toCanvasX(cursorPosition, w, pad);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(cx, pad);
    ctx.lineTo(cx, h - pad);
    ctx.stroke();

    // Cursor dot on the wave
    const cursorY = evaluateWavePoints(pts, cursorPosition);
    const cy = toCanvasY(cursorY, h, pad);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Curve control handles (on-curve, outline circles) — skip zero-width segments
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1];
    if (!p2 || Math.abs(p2.x - p1.x) < 0.001 || Math.abs(p2.y - p1.y) < 0.001) continue;

    const pos = getCurveHandlePos(i, w, h, pad);
    const isHovered = hoveredType.value === "curve" && hoveredIdx.value === i;
    const isDragging = dragType.value === "curve" && dragIdx.value === i;

    // Hover ring
    if (isHovered || isDragging) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, HIT_RADIUS * dpr * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, CURVE_RADIUS * dpr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Anchor points (filled circles)
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const cx = toCanvasX(p.x, w, pad);
    const cy = toCanvasY(p.y, h, pad);
    const isHovered = hoveredType.value === "anchor" && hoveredIdx.value === i;
    const isDragging = dragType.value === "anchor" && dragIdx.value === i;

    // Hover ring
    if (isHovered || isDragging) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      ctx.arc(cx, cy, HIT_RADIUS * dpr * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(cx, cy, ANCHOR_RADIUS * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Hit testing ---

function hitTest(e: PointerEvent | MouseEvent): { type: "anchor" | "curve"; idx: number } | null {
  const canvas = canvasRef.value;
  if (!canvas) return null;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * dpr;
  const my = (e.clientY - rect.top) * dpr;
  const w = canvas.width;
  const h = canvas.height;
  const pad = 10 * dpr;
  const hitDist = HIT_RADIUS * dpr;

  // Check anchors first (higher priority)
  for (let i = 0; i < points.value.length; i++) {
    const p = points.value[i]!;
    const cx = toCanvasX(p.x, w, pad);
    const cy = toCanvasY(p.y, h, pad);
    const dx = mx - cx;
    const dy = my - cy;
    if (dx * dx + dy * dy < hitDist * hitDist) {
      return { type: "anchor", idx: i };
    }
  }

  // Check curve controls — skip zero-width segments
  for (let i = 0; i < points.value.length - 1; i++) {
    const p1 = points.value[i]!;
    const p2 = points.value[i + 1];
    if (!p2 || Math.abs(p2.x - p1.x) < 0.001 || Math.abs(p2.y - p1.y) < 0.001) continue;

    const pos = getCurveHandlePos(i, w, h, pad);
    const dx = mx - pos.x;
    const dy = my - pos.y;
    if (dx * dx + dy * dy < hitDist * hitDist) {
      return { type: "curve", idx: i };
    }
  }

  return null;
}

// --- Pointer events ---

function onPointerMove(e: PointerEvent) {
  if (dragIdx.value !== null) return;
  const hit = hitTest(e);
  if (hit) {
    hoveredType.value = hit.type;
    hoveredIdx.value = hit.idx;
  } else {
    hoveredType.value = null;
    hoveredIdx.value = null;
  }
  requestAnimationFrame(draw);
}

function onPointerDown(e: PointerEvent) {
  if (e.button === 2) return;

  const hit = hitTest(e);
  if (!hit) return;

  e.preventDefault();
  dragIdx.value = hit.idx;
  dragType.value = hit.type;

  const canvas = canvasRef.value!;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  const pad = 10 * dpr;

  function onMove(ev: PointerEvent) {
    if (dragIdx.value === null || !dragType.value) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) * dpr;
    const my = (ev.clientY - rect.top) * dpr;

    const pts = points.value;
    const i = dragIdx.value;

    if (dragType.value === "anchor") {
      const p = pts[i]!;
      const newY = fromCanvasY(my, h, pad);

      if (i === 0 || i === pts.length - 1) {
        // First and last: x locked, y moves together
        pts[0]!.y = newY;
        pts[pts.length - 1]!.y = newY;
      } else {
        // Middle points: x clamped to neighbors (can equal but not pass)
        const prevX = pts[i - 1]?.x ?? 0;
        const nextX = pts[i + 1]?.x ?? 1;
        const newX = fromCanvasX(mx, w, pad);
        p.x = Math.max(prevX, Math.min(nextX, newX));
        p.y = newY;
      }
    } else if (dragType.value === "curve") {
      // On-curve control: drag within the y range of the two anchors
      const p1 = pts[i]!;
      const p2 = pts[i + 1];
      if (!p2) return;

      let newY = fromCanvasY(my, h, pad);
      // Clamp between the two anchor y values (power curve can't overshoot)
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      // Leave a tiny margin so we don't hit exactly 0 or 1 ratio (would be infinite power)
      const margin = Math.abs(p2.y - p1.y) * 0.01;
      newY = Math.max(minY + margin, Math.min(maxY - margin, newY));

      p1.curve = curveFromOnCurveY(p1.y, p2.y, newY);
    }

    requestAnimationFrame(draw);
  }

  function onUp() {
    dragIdx.value = null;
    dragType.value = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function onDblClick(e: MouseEvent) {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const hit = hitTest(e);
  if (hit) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * dpr;
  const my = (e.clientY - rect.top) * dpr;
  const w = canvas.width;
  const h = canvas.height;
  const pad = 10 * dpr;

  const newX = fromCanvasX(mx, w, pad);
  const newY = fromCanvasY(my, h, pad);

  const pts = points.value;
  let insertIdx = pts.length - 1;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i]!.x > newX) {
      insertIdx = i;
      break;
    }
  }

  pts.splice(insertIdx, 0, { x: newX, y: newY, curve: 0 });
  requestAnimationFrame(draw);
}

function onContextMenu(e: MouseEvent) {
  const hit = hitTest(e);
  if (!hit || hit.type !== "anchor") return;
  if (hit.idx === 0 || hit.idx === points.value.length - 1) return;

  e.preventDefault();
  points.value.splice(hit.idx, 1);
  hoveredIdx.value = null;
  hoveredType.value = null;
  requestAnimationFrame(draw);
}

watch(() => [cursorPosition, points.value], () => {
  requestAnimationFrame(draw);
}, { deep: true });

onMounted(() => {
  requestAnimationFrame(draw);
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="h-24 w-full cursor-crosshair rounded-lg"
    @pointermove="onPointerMove"
    @pointerdown="onPointerDown"
    @pointerleave="hoveredIdx = null; hoveredType = null"
    @dblclick="onDblClick"
    @contextmenu="onContextMenu"
  />
</template>
