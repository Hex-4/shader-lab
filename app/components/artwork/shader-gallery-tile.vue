<script setup lang="ts">
import type { ShaderDocument } from "#shared/types/artwork";
import type { LayerInstance, LFOSource, ModulationAssignment } from "#shared/types/editor";

const props = defineProps<{
  id: string;
  name: string;
  thumbnailUrl: string | null;
  data: ShaderDocument;
  isCurrent?: boolean;
}>();

const emit = defineEmits<{
  select: [];
}>();

const isHovered = ref(false);

const layers = computed(() => props.data.layers ?? []);
const lfos = computed(() => props.data.lfos ?? []);
const assignments = computed(() => props.data.assignments ?? []);
const showLivePreview = computed(
  () => isHovered.value && !props.thumbnailUrl && layers.value.length > 0,
);
</script>

<template>
  <button
    type="button"
    class="group flex w-full flex-col gap-2 text-left transition-opacity duration-150"
    :class="isCurrent ? 'cursor-default opacity-60' : 'cursor-pointer hover:opacity-100'"
    :disabled="isCurrent"
    @click="!isCurrent && emit('select')"
    @pointerenter="isHovered = true"
    @pointerleave="isHovered = false"
  >
    <div
      class="relative aspect-video w-full overflow-hidden rounded-xl border bg-base-0 transition-colors duration-150"
      :class="
        isCurrent
          ? 'border-[var(--color-accent,#6cb4ee)] ring-2 ring-[var(--color-accent,#6cb4ee)]/40'
          : 'border-edge group-hover:border-edge-strong'
      "
    >
      <img
        v-if="thumbnailUrl && !showLivePreview"
        :src="thumbnailUrl"
        :alt="name"
        class="size-full object-cover"
      />
      <DashboardCompositionPreview
        v-else-if="showLivePreview"
        :layers="layers as LayerInstance[]"
        :lfos="lfos as LFOSource[]"
        :assignments="assignments as ModulationAssignment[]"
        active
        class="size-full"
      />
      <div
        v-else
        class="flex size-full items-center justify-center bg-surface-1"
      >
        <span class="text-copy-sm text-tertiary">No preview</span>
      </div>

      <span
        v-if="isCurrent"
        class="absolute left-2 top-2 rounded-md bg-[var(--color-accent,#6cb4ee)] px-1.5 py-0.5 text-copy-sm text-white"
      >
        Current
      </span>
    </div>

    <span class="truncate px-0.5 text-copy-sm text-primary">{{ name }}</span>
  </button>
</template>
