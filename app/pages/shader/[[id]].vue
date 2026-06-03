<script setup lang="ts">
import type { LayerInstance, LayerType, LFOSource, ModulationAssignment } from "#shared/types/editor";
import LAYER_TEMPLATES from "#shared/editor/layer-templates";
import { LFO_COLORS, nextLfoColor } from "#shared/editor/lfo-colors";
import { clonePresetPoints } from "#shared/editor/lfo-presets";
import {
  cloneShaderPreset,
  getShaderPreset,
  DEFAULT_PRESET_ID,
} from "#shared/editor/shader-presets";
import type { GradientStop } from "#shared/types";
import type { MeshPoint } from "#shared/types/mesh";

useHead({ title: "Shader — Shader Lab" });

const fromArtwork = computed(() => route.query.fromArtwork as string | undefined);

const route = useRoute();
const canvasRef = ref<HTMLCanvasElement | null>(null);

// --- Load composition from server or preset ---

const routeId = route.params.id as string | undefined;
const presetId = (route.query.preset as string | undefined) ?? DEFAULT_PRESET_ID;
const initialDoc = cloneShaderPreset(
  routeId ? DEFAULT_PRESET_ID : (getShaderPreset(presetId) ? presetId : DEFAULT_PRESET_ID),
);

const shaderId = ref<string | null>(routeId ?? null);
const shaderName = ref(
  routeId ? "Untitled" : (getShaderPreset(presetId)?.name ?? "Untitled"),
);
const layers = ref<LayerInstance[]>(initialDoc.layers);
const lfos = ref<LFOSource[]>(initialDoc.lfos);
const assignments = ref<ModulationAssignment[]>(initialDoc.assignments);

if (routeId) {
  const { data } = await useFetch(`/api/shaders/${routeId}`);
  if (data.value) {
    const comp = data.value as {
      id: string;
      name: string;
      data: { layers: LayerInstance[]; lfos: LFOSource[]; assignments: ModulationAssignment[] };
    };
    shaderId.value = comp.id;
    shaderName.value = comp.name;
    layers.value = comp.data.layers;
    lfos.value = comp.data.lfos;
    assignments.value = comp.data.assignments;
  }
}

// --- Selection state ---

const selectedLayerId = ref<string | null>(
  layers.value.find((l) => l.enabled)?.id ?? layers.value[0]?.id ?? null,
);

const selectedLayer = computed(() => {
  if (!selectedLayerId.value) return null;
  return layers.value.find((l) => l.id === selectedLayerId.value) ?? null;
});

const selectedTemplate = computed(() => {
  if (!selectedLayer.value) return null;
  return LAYER_TEMPLATES[selectedLayer.value.type] ?? null;
});

// --- LFO state ---

const selectedLfoId = ref<string | null>(null);
const draggingLfoId = ref<string | null>(null);

const selectedLfo = computed(() => {
  if (!selectedLfoId.value) return null;
  return lfos.value.find((l) => l.id === selectedLfoId.value) ?? null;
});

// --- Modulation Engine ---

const { lfoValues, lfoPhases, getModulatedValue } = useModulationEngine(lfos, assignments);

const modFn = computed(() => getModulatedValue);

provide("lfoValues", lfoValues);

const selectedLfoCursorPosition = computed(() => {
  if (!selectedLfoId.value) return undefined;
  return lfoPhases.value[selectedLfoId.value];
});

// --- Layer Compiler + Renderer ---

const { passes } = useLayerCompiler(layers, modFn, lfos, assignments);
const { getCanvas } = useMultiPassRenderer(canvasRef, passes, {
  layers,
  getModulatedValue: modFn,
});

// --- Auto-Save ---

const shaderData = computed(() => ({
  version: 1 as const,
  layers: layers.value,
  lfos: lfos.value,
  assignments: assignments.value,
}));

useAutoSave(shaderId, shaderName, shaderData, { kind: "shader", getCanvas });

// --- Layer Management ---

let layerCounter = 100;

function addLayer(type: LayerType) {
  const template = LAYER_TEMPLATES[type];
  if (!template) return;

  const id = `${type}-${++layerCounter}`;
  const values: Record<string, unknown> = {};
  for (const def of template.uniforms) {
    if (def.type === "gradient" && Array.isArray(def.default)) {
      values[def.name] = (def.default as GradientStop[]).map((s) => ({ ...s }));
    } else if (def.type === "meshPoints" && Array.isArray(def.default)) {
      values[def.name] = (def.default as MeshPoint[]).map((p) => ({ ...p }));
    } else {
      values[def.name] = def.default;
    }
  }

  layers.value.unshift({ id, type, enabled: true, values });
  selectedLayerId.value = id;
}

function removeLayer(id: string) {
  const idx = layers.value.findIndex((l) => l.id === id);
  if (idx === -1) return;
  layers.value.splice(idx, 1);
  assignments.value = assignments.value.filter((a) => a.layerId !== id);
  if (selectedLayerId.value === id) {
    selectedLayerId.value = layers.value[Math.min(idx, layers.value.length - 1)]?.id ?? null;
  }
}

function duplicateLayer(id: string) {
  const source = layers.value.find((l) => l.id === id);
  if (!source) return;
  const newId = `${source.type}-${++layerCounter}`;
  const clone: LayerInstance = {
    id: newId,
    type: source.type,
    enabled: source.enabled,
    values: JSON.parse(JSON.stringify(source.values)),
  };
  const idx = layers.value.findIndex((l) => l.id === id);
  layers.value.splice(idx, 0, clone);
  selectedLayerId.value = newId;
}

// --- LFO Management ---

function deleteLfo(id: string) {
  lfos.value = lfos.value.filter((l) => l.id !== id);
  assignments.value = assignments.value.filter((a) => a.sourceId !== id);
  if (selectedLfoId.value === id) selectedLfoId.value = null;
}

function duplicateLfo(id: string) {
  const source = lfos.value.find((l) => l.id === id);
  if (!source) return;
  const newId = `lfo-${Date.now()}`;
  const existingColors = lfos.value.map((l) => l.color);
  const clone: LFOSource = {
    ...source,
    id: newId,
    label: `${source.label}`,
    color: nextLfoColor(existingColors),
    points: source.points.map((p) => ({ ...p })),
  };
  lfos.value.push(clone);
  selectedLfoId.value = newId;
}

function clearLfoAssignments(id: string) {
  assignments.value = assignments.value.filter((a) => a.sourceId !== id);
}

// --- Modulation Assignment Management ---

function assignLfo(paramName: string) {
  if (!draggingLfoId.value || !selectedLayer.value) return;
  assignments.value = assignments.value.filter(
    (a) => !(a.layerId === selectedLayer.value!.id && a.paramName === paramName),
  );
  const template = selectedTemplate.value;
  const def = template?.uniforms.find((u) => u.name === paramName);
  const range = ((def?.max ?? 1) - (def?.min ?? 0)) * 0.15;

  assignments.value.push({
    sourceId: draggingLfoId.value,
    layerId: selectedLayer.value.id,
    paramName,
    depth: range,
  });
  draggingLfoId.value = null;
}

function removeAssignment(sourceId: string, paramName: string) {
  if (!selectedLayer.value) return;
  assignments.value = assignments.value.filter(
    (a) => !(a.sourceId === sourceId && a.layerId === selectedLayer.value!.id && a.paramName === paramName),
  );
}

function updateDepth(sourceId: string, paramName: string, depth: number) {
  const assignment = assignments.value.find(
    (a) => a.sourceId === sourceId && a.layerId === selectedLayer.value?.id && a.paramName === paramName,
  );
  if (assignment) {
    assignment.depth = depth;
  }
}

// --- Drag LFO handling ---

const dragPos = ref({ x: -999, y: -999 });

const draggingLfo = computed(() => {
  if (!draggingLfoId.value) return null;
  return lfos.value.find((l) => l.id === draggingLfoId.value) ?? null;
});

function onDragStart(lfoId: string, x: number, y: number) {
  draggingLfoId.value = lfoId;
  dragPos.value = { x, y };

  function onMove(e: PointerEvent) {
    dragPos.value = { x: e.clientX, y: e.clientY };
  }

  function onUp() {
    setTimeout(() => {
      draggingLfoId.value = null;
      dragPos.value = { x: -999, y: -999 };
    }, 50);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

// --- Selected layer assignments ---

const selectedLayerAssignments = computed(() => {
  if (!selectedLayer.value) return [];
  return assignments.value.filter((a) => a.layerId === selectedLayer.value!.id);
});
</script>

<template>
  <div class="h-dvh overflow-hidden">
  <ClientOnly>
    <canvas
      ref="canvasRef"
      class="fixed inset-0 size-full"
    />

    <!-- Top bar -->
    <div class="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-edge bg-base-1/80 px-3 py-1.5 shadow-2xl backdrop-blur-xl">
      <NuxtLink
        :to="fromArtwork ? `/artwork/${fromArtwork}` : '/'"
        class="text-copy-sm text-tertiary transition-colors duration-150 hover:text-primary"
      >
        {{ fromArtwork ? "Back to artwork" : "Shader Lab" }}
      </NuxtLink>
      <div class="h-4 w-px bg-surface-1" />
      <UiEditableText v-model="shaderName" fill class="text-copy-sm text-secondary" />
    </div>

    <!-- Layer Stack Panel (left) -->
    <EditorLayerStack
      v-model:layers="layers"
      v-model:selected-layer-id="selectedLayerId"
      @add-layer="addLayer"
      @duplicate-layer="duplicateLayer"
      @remove-layer="removeLayer"
    />

    <!-- Layer Settings Panel (right) -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out-expo"
      enter-from-class="translate-x-4 opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition-all duration-200 ease-out-expo"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-4 opacity-0"
    >
      <EditorLayerSettings
        v-if="selectedLayer && selectedTemplate"
        :key="selectedLayer.id"
        :layer="selectedLayer"
        :template="selectedTemplate"
        :assignments="selectedLayerAssignments"
        :lfos="lfos"
        :dragging-lfo-id="draggingLfoId"
        @assign-lfo="assignLfo"
        @remove-assignment="removeAssignment"
        @update-depth="updateDepth"
      />
    </Transition>

    <!-- LFO Config Panel -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out-expo"
      enter-from-class="translate-y-4 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-150 ease-out-expo"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-4 opacity-0"
    >
      <EditorLfoConfig
        v-if="selectedLfo"
        :lfo="selectedLfo"
        :cursor-position="selectedLfoCursorPosition"
        @delete="deleteLfo(selectedLfo!.id)"
      />
    </Transition>

    <!-- Drag ghost -->
    <div
      v-if="draggingLfo"
      class="pointer-events-none fixed z-50 flex w-max items-center gap-2 whitespace-nowrap rounded-lg border border-edge bg-base-1 px-2.5 py-1.5 text-copy-xs font-medium text-primary shadow-2xl"
      :style="{
        left: `${dragPos.x}px`,
        top: `${dragPos.y}px`,
        transform: 'translate(-50%, -50%)',
      }"
    >
      <span class="size-2.5 rounded-full" :style="{ backgroundColor: draggingLfo.color }" />
      <span>{{ draggingLfo.label }}</span>
    </div>

    <!-- LFO Rack (bottom bar) -->
    <EditorLfoRack
      v-model:lfos="lfos"
      v-model:selected-lfo-id="selectedLfoId"
      @drag-start="(id: string, x: number, y: number) => onDragStart(id, x, y)"
      @duplicate-lfo="duplicateLfo"
      @clear-assignments="clearLfoAssignments"
      @delete-lfo="deleteLfo"
    />
  </ClientOnly>
  </div>
</template>
