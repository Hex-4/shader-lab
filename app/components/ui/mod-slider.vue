<script setup lang="ts">
type Props = {
  base: number;
  depth: number;
  min: number;
  max: number;
  step?: number;
  color: string;
  liveValue?: number; // 0-1 LFO output, used for live indicator position
};

type Emits = {
  "update:depth": [value: number];
};

const { base, depth, min, max, step = 0.01, color, liveValue } = defineProps<Props>();
const emit = defineEmits<Emits>();

const trackRef = ref<HTMLElement | null>(null);

const range = computed(() => max - min);

// Positions as percentages
const basePct = computed(() => Math.max(0, Math.min(100, ((base - min) / range.value) * 100)));

const endpointPct = computed(() => {
  const endpoint = Math.max(min, Math.min(max, base + depth));
  return ((endpoint - min) / range.value) * 100;
});

// Track bar: from base to endpoint (or endpoint to base if depth is negative)
const barLeft = computed(() => Math.min(basePct.value, endpointPct.value));
const barWidth = computed(() => Math.abs(endpointPct.value - basePct.value));

// Live indicator position
const livePct = computed(() => {
  if (liveValue == null) return null;
  const livePos = base + liveValue * depth;
  const clamped = Math.max(min, Math.min(max, livePos));
  return ((clamped - min) / range.value) * 100;
});

// Clamp detection
const isClampedLeft = computed(() => {
  const endpoint = base + depth;
  return endpoint < min || (depth < 0 && base + depth * 0 < min); // if the LFO swing would go below min
});
const isClampedRight = computed(() => {
  const endpoint = base + depth;
  return endpoint > max;
});
// More precise: clamp shows when the endpoint would exceed bounds
const clampedAtMin = computed(() => (base + Math.min(0, depth)) < min);
const clampedAtMax = computed(() => (base + Math.max(0, depth)) > max);

// Drag interaction
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();

  function onMove(ev: PointerEvent) {
    if (!trackRef.value) return;
    const rect = trackRef.value.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
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
    <!-- Track bar: from base to endpoint -->
    <div
      class="absolute top-1/2 h-1 -translate-y-1/2 rounded-[1px] bg-surface-1"
      :style="{
        left: `${barLeft}%`,
        width: `${Math.max(barWidth, 0.5)}%`,
      }"
    />

    <!-- Live indicator -->
    <div
      v-if="livePct != null"
      class="absolute top-1/2 h-1 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-inverse/30"
      :style="{ left: `${livePct}%` }"
    />

    <!-- Mod knob (endpoint) -->
    <div
      class="absolute top-1/2 h-1 w-px -translate-x-1/2 -translate-y-1/2 rounded-[1px] transition-transform duration-150 group-hover:scale-[2]"
      :style="{ left: `${endpointPct}%`, backgroundColor: color }"
    />

    <!-- Clamp indicator left -->
    <div
      v-if="clampedAtMin"
      class="absolute left-0 top-1/2 h-1.5 w-px -translate-y-1/2 rounded-full bg-danger"
    />

    <!-- Clamp indicator right -->
    <div
      v-if="clampedAtMax"
      class="absolute right-0 top-1/2 h-1.5 w-px -translate-y-1/2 rounded-full bg-danger"
    />
  </div>
</template>
