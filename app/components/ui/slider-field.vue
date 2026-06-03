<script setup lang="ts">
type Props = {
  name?: string;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  modColor?: string;
  modDepth?: number;
  modLiveValue?: number;
  isDropTarget?: boolean;
};

type Emits = {
  "update:mod-depth": [value: number];
};

const { name, label, min = 0, max = 1, step = 0.01, disabled = false, modColor, modDepth, modLiveValue, isDropTarget = false } = defineProps<Props>();
const emit = defineEmits<Emits>();

const model = defineModel<number>({ default: 0.5 });

const hasModulation = computed(() => modColor != null && modDepth != null);

const isEditing = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

const displayValue = computed(() => {
  if (Number.isInteger(step) && step >= 1) {
    return model.value.toFixed(0);
  }
  if (step >= 0.1) {
    return model.value.toFixed(1);
  }
  return model.value.toFixed(2);
});

function startEdit() {
  isEditing.value = true;
  nextTick(() => {
    inputRef.value?.select();
  });
}

function commitValue(e: Event) {
  const input = e.target as HTMLInputElement;
  const parsed = parseFloat(input.value);
  if (!isNaN(parsed)) {
    const snapped = Math.round(parsed / step) * step;
    model.value = Math.min(max, Math.max(min, snapped));
  }
  isEditing.value = false;
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div
      v-if="label"
      class="flex items-center justify-between"
    >
      <span class="text-copy-sm text-secondary select-none">{{ label }}</span>
      <input
        v-if="isEditing"
        ref="inputRef"
        :value="displayValue"
        type="text"
        class="h-4 w-12 rounded bg-surface-2 px-1 text-right font-mono text-copy-sm text-primary outline-none ring-1 ring-edge-strong"
        @blur="commitValue"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
        @keydown.escape="isEditing = false"
      />
      <button
        v-else
        class="h-4 min-w-8 cursor-text rounded px-1 text-right font-mono text-copy-sm text-tertiary transition-colors hover:text-secondary"
        @click="startEdit"
      >
        {{ displayValue }}
      </button>
    </div>
    <div class="grid rounded bg-base-0 transition-[grid-template-rows] duration-200 ease-out-expo" :style="{ gridTemplateRows: hasModulation ? '1fr auto' : '0fr auto' }">
      <div class="min-h-0 overflow-hidden">
        <UiModSlider
          :base="model"
          :depth="modDepth ?? 0"
          :min="min"
          :max="max"
          :step="step"
          :color="modColor ?? '#fff'"
          :live-value="modLiveValue"
          @update:depth="emit('update:mod-depth', $event)"
        />
      </div>
      <UiSlider
        v-model="model"
        :name="name"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        :is-drop-target="isDropTarget"
      />
    </div>
  </div>
</template>
