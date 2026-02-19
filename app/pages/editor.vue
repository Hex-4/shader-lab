<script setup lang="ts">
import type { LayerInstance, LayerType, LFOSource, ModulationAssignment } from "#shared/types/editor";
import LAYER_TEMPLATES from "#shared/editor/layer-templates";
import { LFO_COLORS, nextLfoColor } from "#shared/editor/lfo-colors";
import { clonePresetPoints } from "#shared/editor/lfo-presets";
import type { GradientStop } from "#shared/types";

useHead({ title: "Editor — Shader Lab" });

const canvasRef = ref<HTMLCanvasElement | null>(null);

// --- Layer state ---

const layers = ref<LayerInstance[]>([
  {
    id: "vignette-1",
    type: "vignette",
    enabled: true,
    values: { shape: 0, vignetteIntensity: 1.0, vignetteRadius: 0.4, vignetteSoftness: 0.4 },
  },
  {
    id: "dither-1",
    type: "dither",
    enabled: true,
    values: { levels: 16, ditherScale: 4 },
  },
  {
    id: "grain-1",
    type: "grain",
    enabled: true,
    values: { grainIntensity: 0.02, ditherScale: 4.0, speed: 50.0 },
  },
  {
    id: "distortion-2",
    type: "distortion",
    enabled: true,
    values: { waveType: 0, freq: 1.5, amplitude: 0.4, sharpness: 6.7, pulseWidth: 0, skew: 0, direction: 90 },
  },
  {
    id: "distortion-1",
    type: "distortion",
    enabled: true,
    values: { waveType: 1, freq: 3, amplitude: 0.51, sharpness: 6.7, pulseWidth: 0.04, skew: 0, direction: 45 },
  },
  {
    id: "gradient-1",
    type: "gradient",
    enabled: true,
    values: {
      u_gradient: [
        { color: "#000000", position: 0 },
        { color: "#330d03", position: 0.15 },
        { color: "#f35a0d", position: 0.35 },
        { color: "#fff2d9", position: 0.6 },
        { color: "#0f3839", position: 0.85 },
        { color: "#000000", position: 1.0 },
      ],
      angle: 90,
      offsetX: 0,
    },
  },
]);

const selectedLayerId = ref<string | null>("distortion-1");

const selectedLayer = computed(() => {
  if (!selectedLayerId.value) return null;
  return layers.value.find((l) => l.id === selectedLayerId.value) ?? null;
});

const selectedTemplate = computed(() => {
  if (!selectedLayer.value) return null;
  return LAYER_TEMPLATES[selectedLayer.value.type] ?? null;
});

// --- LFO Modulation ---

const lfos = ref<LFOSource[]>([
  { id: "lfo-1", label: "LFO 1", color: LFO_COLORS[0]!, points: clonePresetPoints("sine"), rate: 0.5, phase: 0, mode: "loop" },
]);

const assignments = ref<ModulationAssignment[]>([
  { sourceId: "lfo-1", layerId: "distortion-1", paramName: "direction", depth: 30 },
  { sourceId: "lfo-1", layerId: "distortion-1", paramName: "amplitude", depth: 0.2 },
]);

const selectedLfoId = ref<string | null>(null);
const draggingLfoId = ref<string | null>(null);

const selectedLfo = computed(() => {
  if (!selectedLfoId.value) return null;
  return lfos.value.find((l) => l.id === selectedLfoId.value) ?? null;
});

// --- Modulation Engine ---

const { lfoValues, lfoPhases, getModulatedValue } = useModulationEngine(lfos, assignments);

const modFn = computed(() => getModulatedValue);

// Provide lfoValues for live indicators on sliders
provide("lfoValues", lfoValues);

// Cursor position for the selected LFO's wave editor
const selectedLfoCursorPosition = computed(() => {
  if (!selectedLfoId.value) return undefined;
  return lfoPhases.value[selectedLfoId.value];
});

// --- Layer Compiler + Renderer ---

const { passes } = useLayerCompiler(layers, modFn);
useMultiPassRenderer(canvasRef, passes);

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
  // Remove existing assignment for this param on this layer (only one LFO per param)
  assignments.value = assignments.value.filter(
    (a) => !(a.layerId === selectedLayer.value!.id && a.paramName === paramName),
  );
  // Find the param's range to set a reasonable default depth
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

// --- Layer settings assignments for selected layer ---

const selectedLayerAssignments = computed(() => {
  if (!selectedLayer.value) return [];
  return assignments.value.filter((a) => a.layerId === selectedLayer.value!.id);
});
</script>

<template>
  <ClientOnly>
    <canvas
      ref="canvasRef"
      class="fixed inset-0 size-full"
    />

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
</template>
