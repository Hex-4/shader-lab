<script setup lang="ts">
import type { Component } from "vue";
import { EyeIcon, EyeOffIcon, Trash2Icon, SparklesIcon, WavesIcon, SlidersHorizontalIcon } from "lucide-vue-next";
import type { LayerInstance, LayerCategory } from "#shared/types/editor";
import LAYER_TEMPLATES from "#shared/editor/layer-templates";

type Props = {
  layer: LayerInstance;
  selected: boolean;
  dragging?: boolean;
};

type Emits = {
  select: [];
  "toggle-enabled": [];
  remove: [];
};

const { layer, selected, dragging = false } = defineProps<Props>();
const emit = defineEmits<Emits>();

const template = computed(() => LAYER_TEMPLATES[layer.type]);

const categoryIcons: Record<LayerCategory, Component> = {
  generator: SparklesIcon,
  distortion: WavesIcon,
  effect: SlidersHorizontalIcon,
};

const categoryIcon = computed(() => {
  if (!template.value) return null;
  return categoryIcons[template.value.category];
});
</script>

<template>
  <div
    class="group flex cursor-default items-center gap-2 rounded-lg px-2 py-2 transition-colors duration-150 select-none"
    :class="[
      selected
        ? 'bg-surface-1 text-primary'
        : 'text-secondary hover:bg-surface-1 hover:text-primary',
      dragging && 'scale-[1.02] bg-surface-2 shadow-lg',
    ]"
    @click="emit('select')"
  >
    <component
      v-if="!layer.enabled"
      :is="EyeOffIcon"
      class="size-3.5 shrink-0 text-tertiary"
    />
    <component
      v-else-if="categoryIcon"
      :is="categoryIcon"
      class="size-3.5 shrink-0 text-tertiary"
    />

    <span class="flex-1 truncate text-copy-sm" :class="!layer.enabled && 'text-tertiary'">
      {{ template?.label ?? layer.type }}
    </span>

    <div
      class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150"
      :class="(selected || !layer.enabled) ? 'opacity-100' : 'group-hover:opacity-100'"
    >
      <button
        class="flex size-6 items-center justify-center rounded-md text-tertiary transition-colors duration-150 hover:bg-surface-1 hover:text-secondary"
        title="Toggle visibility"
        @click.stop="emit('toggle-enabled')"
      >
        <EyeIcon v-if="layer.enabled" class="size-3.5" />
        <EyeOffIcon v-else class="size-3.5" />
      </button>
    </div>

    <button
      class="flex size-6 shrink-0 items-center justify-center rounded-md text-tertiary opacity-0 transition-all duration-150 hover:bg-surface-1 hover:text-secondary"
      :class="selected ? 'opacity-100' : 'group-hover:opacity-100'"
      title="Remove layer"
      @click.stop="emit('remove')"
    >
      <Trash2Icon class="size-3.5" />
    </button>
  </div>
</template>
