<script setup lang="ts">
import type { LFOSource, ModulationAssignment } from "#shared/types/editor";
import type { MeshPoint } from "#shared/types/mesh";
import { MESH_MAX_POINTS } from "#shared/types/mesh";
import { meshParamName, type MeshPointField } from "#shared/editor/mesh-uniforms";

const model = defineModel<MeshPoint[]>({ required: true });

const props = defineProps<{
  layerId: string;
  assignments: ModulationAssignment[];
  lfos: LFOSource[];
  draggingLfoId: string | null;
}>();

const emit = defineEmits<{
  "assign-lfo": [paramName: string];
  "remove-assignment": [sourceId: string, paramName: string];
  "update-depth": [sourceId: string, paramName: string, depth: number];
}>();

const labels = ["1", "2", "3", "4", "5", "6"];

const lfoValues = inject<Ref<Record<string, number>>>("lfoValues", ref({}));

function ensurePoints(points: MeshPoint[]): MeshPoint[] {
  const out = [...points];
  while (out.length < MESH_MAX_POINTS) {
    out.push({ x: 0.5, y: 0.5, color: "#808080", radius: 0.5 });
  }
  return out.slice(0, MESH_MAX_POINTS);
}

const points = computed({
  get: () => ensurePoints(model.value),
  set: (v) => {
    model.value = v;
  },
});

function updatePoint(index: number, patch: Partial<MeshPoint>) {
  const next = ensurePoints(model.value);
  next[index] = { ...next[index]!, ...patch };
  model.value = next;
}

function getAssignment(paramName: string): ModulationAssignment | undefined {
  return props.assignments.find(
    (a) => a.layerId === props.layerId && a.paramName === paramName,
  );
}

function getLfoColor(sourceId: string): string | undefined {
  return props.lfos.find((l) => l.id === sourceId)?.color;
}

function getLiveValue(paramName: string): number | undefined {
  const assignment = getAssignment(paramName);
  if (!assignment) return undefined;
  return lfoValues.value[assignment.sourceId];
}

function getModInfo(paramName: string): { color: string; depth: number } | null {
  const assignment = getAssignment(paramName);
  if (!assignment) return null;
  const color = getLfoColor(assignment.sourceId);
  if (!color) return null;
  return { color, depth: assignment.depth };
}

function onDepthUpdate(paramName: string, depth: number) {
  const assignment = getAssignment(paramName);
  if (!assignment) return;
  emit("update-depth", assignment.sourceId, paramName, depth);
}

type SliderSpec = {
  field: MeshPointField;
  label: string;
  min: number;
  max: number;
  step: number;
};

const sliderSpecs: SliderSpec[] = [
  { field: "x", label: "X", min: 0, max: 1, step: 0.01 },
  { field: "y", label: "Y", min: 0, max: 1, step: 0.01 },
  { field: "radius", label: "Radius", min: 0.15, max: 1.5, step: 0.01 },
];
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="(pt, i) in points"
      :key="i"
      class="flex flex-col gap-2 rounded-xl bg-surface-1 p-2.5"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="text-copy-xs font-medium text-secondary select-none">Point {{ labels[i] }}</span>
        <UiColorField
          :model-value="pt.color"
          class="shrink-0"
          @update:model-value="updatePoint(i, { color: $event })"
        />
      </div>

      <UiContextMenu
        v-for="spec in sliderSpecs"
        :key="spec.field"
      >
        <div @pointerup="draggingLfoId && emit('assign-lfo', meshParamName(i, spec.field))">
          <UiSliderField
            :model-value="pt[spec.field]"
            :label="spec.label"
            :min="spec.min"
            :max="spec.max"
            :step="spec.step"
            :mod-color="getModInfo(meshParamName(i, spec.field))?.color"
            :mod-depth="getModInfo(meshParamName(i, spec.field))?.depth"
            :mod-live-value="getLiveValue(meshParamName(i, spec.field))"
            :is-drop-target="draggingLfoId !== null"
            @update:model-value="updatePoint(i, { [spec.field]: $event })"
            @update:mod-depth="onDepthUpdate(meshParamName(i, spec.field), $event)"
          />
        </div>
        <template #menu>
          <template v-if="getAssignment(meshParamName(i, spec.field))">
            <UiContextMenuItem
              @click="emit('remove-assignment', getAssignment(meshParamName(i, spec.field))!.sourceId, meshParamName(i, spec.field))"
            >
              <span
                class="size-2 rounded-full"
                :style="{ backgroundColor: getLfoColor(getAssignment(meshParamName(i, spec.field))!.sourceId) }"
              />
              Remove {{ lfos.find(l => l.id === getAssignment(meshParamName(i, spec.field))!.sourceId)?.label }}
            </UiContextMenuItem>
          </template>
        </template>
      </UiContextMenu>
    </div>
  </div>
</template>
