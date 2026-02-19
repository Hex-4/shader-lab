<script setup lang="ts">
import type { LFOSource } from "#shared/types/editor";

type Props = {
  lfo: LFOSource;
  selected: boolean;
};

type Emits = {
  select: [];
  "drag-start": [];
};

const { lfo, selected } = defineProps<Props>();
const emit = defineEmits<Emits>();

let startX = 0;
let startY = 0;
let isDragging = false;

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  startX = e.clientX;
  startY = e.clientY;
  isDragging = false;

  function onMove(ev: PointerEvent) {
    if (!isDragging && (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4)) {
      isDragging = true;
      emit("drag-start");
    }
  }

  function onUp() {
    if (!isDragging) {
      emit("select");
    }
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
</script>

<template>
  <button
    class="flex h-8 items-center gap-2 rounded-lg border px-2.5 text-copy-xs font-medium transition-all duration-150 select-none"
    :class="selected
      ? 'border-edge bg-surface-1 text-primary'
      : 'border-transparent bg-surface-1/50 text-secondary hover:bg-surface-1 hover:text-primary'"
    @pointerdown="onPointerDown"
  >
    <span class="size-2.5 rounded-full" :style="{ backgroundColor: lfo.color }" />
    <span>{{ lfo.label }}</span>
  </button>
</template>
