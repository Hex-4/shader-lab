<script setup lang="ts">
import { PlusIcon } from "lucide-vue-next";
import type { LFOSource } from "#shared/types/editor";
import { LFO_COLORS, nextLfoColor } from "#shared/editor/lfo-colors";
import { clonePresetPoints } from "#shared/editor/lfo-presets";

type Emits = {
  "drag-start": [lfoId: string, x: number, y: number];
  "duplicate-lfo": [lfoId: string];
  "clear-assignments": [lfoId: string];
  "delete-lfo": [lfoId: string];
};

const lfos = defineModel<LFOSource[]>("lfos", { required: true });
const selectedLfoId = defineModel<string | null>("selectedLfoId", { required: true });
const emit = defineEmits<Emits>();

let lfoCounter = 1;

function addLfo() {
  const existingColors = lfos.value.map((l) => l.color);
  const id = `lfo-${++lfoCounter}`;
  lfos.value.push({
    id,
    label: `LFO ${lfos.value.length + 1}`,
    color: nextLfoColor(existingColors),
    points: clonePresetPoints("sine"),
    rate: 1.0,
    phase: 0,
    mode: "loop",
  });
  selectedLfoId.value = id;
}

function selectLfo(id: string) {
  selectedLfoId.value = selectedLfoId.value === id ? null : id;
}
</script>

<template>
  <div class="fixed bottom-4 left-60 right-80 z-40 mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-edge bg-base-1/80 p-2 shadow-2xl backdrop-blur-xl">
    <EditorLfoPill
      v-for="lfo in lfos"
      :key="lfo.id"
      :lfo="lfo"
      :selected="selectedLfoId === lfo.id"
      @select="selectLfo(lfo.id)"
      @drag-start="(x: number, y: number) => emit('drag-start', lfo.id, x, y)"
      @duplicate="emit('duplicate-lfo', lfo.id)"
      @clear-assignments="emit('clear-assignments', lfo.id)"
      @delete="emit('delete-lfo', lfo.id)"
    />
    <button
      class="flex size-8 items-center justify-center rounded-lg text-tertiary transition-colors duration-150 hover:bg-surface-1 hover:text-secondary"
      title="Add LFO"
      @click="addLfo"
    >
      <PlusIcon class="size-3.5" />
    </button>
  </div>
</template>
