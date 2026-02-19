<script setup lang="ts">
import { SliderRoot, SliderThumb, SliderTrack } from "reka-ui";

type Props = {
  name?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  isDropTarget?: boolean;
};

const {
  name,
  min = 0,
  max = 1,
  step = 0.01,
  disabled = false,
  isDropTarget = false,
} = defineProps<Props>();

const model = defineModel<number>({ default: 0.5 });

const isDragging = ref(false);

const percentage = computed(() => (model.value - min) / (max - min));

const thumbWidthPx = 14;

function onPointerDown(e: PointerEvent) {
  if (e.button === 2) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  isDragging.value = true;
}
</script>

<template>
  <div @pointerdown.capture="onPointerDown">
  <SliderRoot
    :model-value="[model]"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :name="name"
    as="div"
    class="relative outline-none"
    @update:model-value="(val?: number[]) => (model = val?.[0] ?? model)"
    @pointerup="isDragging = false"
    @pointercancel="isDragging = false"
  >
    <SliderTrack
      as="div"
      :class="[
        'group relative h-7 rounded bg-surface-1 p-px outline-none transition-shadow duration-150 ease-out-expo',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-ew-resize',
        isDropTarget && 'ring-1 ring-focus-subtle hover:ring-2 hover:ring-accent',
      ]"
      :style="{ '--slider-percentage': percentage, '--thumb-width': `${thumbWidthPx}px` } as any"
    >
      <!-- Fill bar -->
      <div
        :class="[
          'absolute flex items-center justify-end rounded-sm bg-surface-2 shadow-slider duration-300 ease-out-expo',
          'inset-y-px left-px',
          isDragging
            ? 'transition-[inset,border-radius]'
            : 'transition-[inset,border-radius,width]',
          !disabled && 'group-active:rounded group-active:inset-y-0 group-active:left-0',
        ]"
        style="width: calc(var(--thumb-width) + var(--slider-percentage) * (100% - var(--thumb-width)))"
      >
        <!-- Thin line indicator -->
        <div
          :class="[
            'mr-0.5 h-3.5 w-0.5 rounded-full transition-colors duration-150 ease-out-expo',
            'bg-inverse/20',
            !disabled && 'group-hover:bg-inverse/35',
            !disabled && 'group-active:bg-inverse/50',
          ]"
        />
      </div>
      <SliderThumb class="size-0 focus:outline-none focus-visible:outline-none" />
    </SliderTrack>
  </SliderRoot>
  </div>
</template>
