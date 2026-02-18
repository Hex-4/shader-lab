<script setup lang="ts">
import type { LayerInstance, LayerType } from "#shared/types/editor";
import LAYER_TEMPLATES from "#shared/editor/layer-templates";
import type { GradientStop } from "#shared/types";

useHead({ title: "Editor — Shader Lab" });

const canvasRef = ref<HTMLCanvasElement | null>(null);

// Layer state — stored in visual order (top → bottom).
// The compiler reverses before rendering so the bottom layer renders first.
const layers = ref<LayerInstance[]>([
  {
    id: "vignette-1",
    type: "vignette",
    enabled: true,
    values: {
      shape: 0,
      vignetteIntensity: 1.0,
      vignetteRadius: 0.4,
      vignetteSoftness: 0.4,
    },
    animationEnabled: false,
    animationValues: {},
  },
  {
    id: "dither-1",
    type: "dither",
    enabled: true,
    values: {
      levels: 16,
      ditherScale: 4,
    },
    animationEnabled: false,
    animationValues: {},
  },
  {
    id: "grain-1",
    type: "grain",
    enabled: true,
    values: {
      grainIntensity: 0.02,
      ditherScale: 4.0,
    },
    animationEnabled: true,
    animationValues: { speed: 50.0 },
  },
  {
    id: "distortion-2",
    type: "distortion",
    enabled: true,
    values: {
      waveType: 0,
      freq: 1.5,
      amplitude: 0.4,
      direction: 90,
      sharpness: 6.7,
      pulseWidth: 0,
      skew: 0,
    },
    animationEnabled: true,
    animationValues: { speed: 1.0, drift: 0.3 },
  },
  {
    id: "distortion-1",
    type: "distortion",
    enabled: true,
    values: {
      waveType: 1,
      freq: 3,
      amplitude: 0.51,
      direction: 45,
      sharpness: 6.7,
      pulseWidth: 0.04,
      skew: 0,
    },
    animationEnabled: true,
    animationValues: { speed: 1.0, drift: 0.5 },
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
    animationEnabled: true,
    animationValues: { speed: 1.0 },
  },
]);

const selectedLayerId = ref<string | null>("wave-1");

const selectedLayer = computed(() => {
  if (!selectedLayerId.value) return null;
  return layers.value.find((l) => l.id === selectedLayerId.value) ?? null;
});

const selectedTemplate = computed(() => {
  if (!selectedLayer.value) return null;
  return LAYER_TEMPLATES[selectedLayer.value.type] ?? null;
});

// Compile layers to render passes
const { passes } = useLayerCompiler(layers);

// Multi-pass renderer
useMultiPassRenderer(canvasRef, passes);

// Layer management
let layerCounter = 100;

function addLayer(type: LayerType) {
  const template = LAYER_TEMPLATES[type];
  if (!template) return;

  const id = `${type}-${++layerCounter}`;

  // Build default values from template
  const values: Record<string, unknown> = {};
  for (const def of template.uniforms) {
    if (def.type === "gradient" && Array.isArray(def.default)) {
      values[def.name] = (def.default as GradientStop[]).map((s) => ({ ...s }));
    } else {
      values[def.name] = def.default;
    }
  }

  const animationValues: Record<string, unknown> = {};
  if (template.animationUniforms) {
    for (const def of template.animationUniforms) {
      animationValues[def.name] = def.default;
    }
  }

  layers.value.unshift({
    id,
    type,
    enabled: true,
    values,
    animationEnabled: !!template.animationUniforms,
    animationValues,
  });

  selectedLayerId.value = id;
}

function removeLayer(id: string) {
  const idx = layers.value.findIndex((l) => l.id === id);
  if (idx === -1) return;
  layers.value.splice(idx, 1);
  if (selectedLayerId.value === id) {
    selectedLayerId.value = layers.value[Math.min(idx, layers.value.length - 1)]?.id ?? null;
  }
}
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
      />
    </Transition>
  </ClientOnly>
</template>
