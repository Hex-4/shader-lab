<script setup lang="ts">
type Props = {
  base: number;
  depth: number;
  min: number;
  max: number;
  step?: number;
  color: string;
  liveValue?: number;
};

type Emits = {
  "update:depth": [value: number];
};

const { base, depth, min, max, step = 0.01, color, liveValue } = defineProps<Props>();
const emit = defineEmits<Emits>();

const trackRef = ref<HTMLElement | null>(null);

const range = computed(() => max - min);

// Match the main slider's positioning: the thumb is 14px wide, track has 1px padding
// The indicator sits at: 1px + 14px * (1 - pct) / 2 + pct * (trackWidth - 1px)
// Simplified: the effective range starts at thumbWidth/2 + padding and ends at trackWidth - thumbWidth/2 - padding
// We use calc() in CSS to match this exactly
const THUMB_PX = 14;
const PAD_PX = 1;
// The main slider's indicator line sits at the right edge of the fill bar.
// Fill width at pct: THUMB_PX + pct * (100% - THUMB_PX)
// Indicator position from track left: PAD + fill_width - ~2px (margin + half line width)
// Zero point: PAD + THUMB_PX - 2 = 13px
// Full point: PAD + 100% - 2px
// Usable range: 100% - PAD - THUMB_PX + 2 - PAD + 2 ≈ 100% - 16px + 2px... 
// Simpler: indicator at pct is at left edge of fill + fill width - margin
// = PAD + THUMB_PX + pct * (trackWidth - THUMB_PX) - margin
// In CSS calc: calc(13px + pct * (100% - 14px))
const ZERO_OFFSET = PAD_PX + THUMB_PX - 2; // 13px — where the indicator sits at 0%

function toPos(pct: number): string {
  // indicator position = ZERO_OFFSET + pct * (100% - THUMB_PX)
  return `calc(${ZERO_OFFSET}px + ${(pct * 100).toFixed(2)}% - ${(pct * THUMB_PX).toFixed(2)}px)`;
}

const basePct = computed(() => Math.max(0, Math.min(1, (base - min) / range.value)));

const endpointPct = computed(() => {
  const endpoint = Math.max(min, Math.min(max, base + depth));
  return Math.max(0, Math.min(1, (endpoint - min) / range.value));
});

const livePct = computed(() => {
  if (liveValue == null) return null;
  const livePos = base + liveValue * depth;
  const clamped = Math.max(min, Math.min(max, livePos));
  return Math.max(0, Math.min(1, (clamped - min) / range.value));
});

const clampedAtMin = computed(() => (base + Math.min(0, depth)) < min);
const clampedAtMax = computed(() => (base + Math.max(0, depth)) > max);

// Bar position and width
const barLeftPct = computed(() => Math.min(basePct.value, endpointPct.value));
const barRightPct = computed(() => Math.max(basePct.value, endpointPct.value));

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();

  function onMove(ev: PointerEvent) {
    if (!trackRef.value) return;
    const rect = trackRef.value.getBoundingClientRect();
    const usableWidth = rect.width - THUMB_PX;
    const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left - ZERO_OFFSET) / usableWidth));
    const endpoint = min + pct * range.value;
    const snapped = Math.round(endpoint / step) * step;
    const clamped = Math.max(min, Math.min(max, snapped));
    emit("update:depth", clamped - base);
  }

  onMove(e);

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
</script>

<template>
  <div
    ref="trackRef"
    class="group relative h-3 cursor-ew-resize"
    @pointerdown="onPointerDown"
  >
    <!-- Anchor line (at base position) -->
    <div
      class="absolute top-1/2 h-1 w-px -translate-x-1/2 -translate-y-1/2"
      :style="{ left: toPos(basePct), backgroundColor: `${color}40` }"
    />

    <!-- Track bar: from base to endpoint -->
    <div
      class="absolute top-1/2 h-1 -translate-y-1/2 rounded-[1px] bg-surface-1"
      :style="{
        left: toPos(barLeftPct),
        width: `calc(${toPos(barRightPct)} - ${toPos(barLeftPct)})`,
      }"
    />

    <!-- Live indicator -->
    <div
      v-if="livePct != null"
      class="absolute top-1/2 h-1 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-inverse/30"
      :style="{ left: toPos(livePct) }"
    />

    <!-- Mod knob (endpoint) -->
    <div
      class="absolute top-1/2 h-1 w-px -translate-x-1/2 -translate-y-1/2 rounded-[1px] transition-transform duration-150 group-hover:scale-[2]"
      :style="{ left: toPos(endpointPct), backgroundColor: color }"
    />

    <!-- Clamp indicator left -->
    <div
      v-if="clampedAtMin"
      class="absolute top-1/2 h-1.5 w-px -translate-y-1/2 rounded-full bg-danger"
      :style="{ left: toPos(0) }"
    />

    <!-- Clamp indicator right -->
    <div
      v-if="clampedAtMax"
      class="absolute top-1/2 h-1.5 w-px -translate-y-1/2 rounded-full bg-danger"
      :style="{ left: toPos(1) }"
    />
  </div>
</template>
