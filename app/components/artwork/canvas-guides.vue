<script setup lang="ts">
import type { ArtworkCanvas } from "#shared/types/artwork";
import type { DistanceLabel, SnapGuide } from "#shared/artwork/canvas-snap";
import { pxToPercent } from "#shared/artwork/canvas-snap";

const props = defineProps<{
  canvas: ArtworkCanvas;
  guides: SnapGuide[];
  distances: DistanceLabel[];
}>();

function labelStyle(m: DistanceLabel) {
  const { width, height } = props.canvas;
  if (m.axis === "x") {
    const left = ((m.from + m.to) / 2 / width) * 100;
    const top = (m.cross / height) * 100;
    return { left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" };
  }
  const left = (m.cross / width) * 100;
  const top = ((m.from + m.to) / 2 / height) * 100;
  return { left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" };
}

function lineStyle(m: DistanceLabel) {
  const { width, height } = props.canvas;
  if (m.axis === "x") {
    return {
      left: pxToPercent(m.from, width),
      top: pxToPercent(m.cross, height),
      width: pxToPercent(m.to - m.from, width),
      height: "0",
      transform: "translateY(-50%)",
    };
  }
  return {
    left: pxToPercent(m.cross, width),
    top: pxToPercent(m.from, height),
    width: "0",
    height: pxToPercent(m.to - m.from, height),
    transform: "translateX(-50%)",
  };
}
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-20 overflow-hidden">
    <div
      v-for="(g, i) in guides"
      :key="`g-${g.axis}-${g.position}-${i}`"
      class="absolute bg-[var(--color-accent,#e85d8a)]"
      :class="g.axis === 'x' ? 'top-0 h-full w-px' : 'left-0 h-px w-full'"
      :style="
        g.axis === 'x'
          ? { left: pxToPercent(g.position, canvas.width) }
          : { top: pxToPercent(g.position, canvas.height) }
      "
    />

    <template
      v-for="(m, i) in distances"
      :key="`d-${m.axis}-${m.from}-${m.to}-${i}`"
    >
      <div
        class="absolute border-[var(--color-accent,#e85d8a)]"
        :class="m.axis === 'x' ? 'border-t' : 'border-l'"
        :style="lineStyle(m)"
      />
      <div
        class="absolute z-10 rounded bg-[var(--color-accent,#e85d8a)] px-1.5 py-0.5 text-white tabular-nums"
        :style="labelStyle(m)"
      >
        {{ Math.round(m.value) }}
      </div>
    </template>
  </div>
</template>
