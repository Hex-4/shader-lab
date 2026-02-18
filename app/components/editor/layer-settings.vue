<script setup lang="ts">
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from "reka-ui";
import { ChevronRightIcon, DicesIcon, RotateCcwIcon } from "lucide-vue-next";
import type { LayerInstance, LayerTemplate, LayerUniformDef } from "#shared/types/editor";
import type { GradientStop } from "#shared/types";

type Props = {
  layer: LayerInstance;
  template: LayerTemplate;
};

const { layer, template } = defineProps<Props>();

const settingsOpen = ref(true);
const animationOpen = ref(true);

// --- Randomize ---

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function randomizeUniforms(defs: LayerUniformDef[], target: Record<string, unknown>) {
  for (const def of defs) {
    if (def.type === "float" || def.type === "int") {
      const min = def.min ?? 0;
      const max = def.max ?? 1;
      const step = def.step ?? 0.01;
      const padding = (max - min) * 0.2;
      const raw = (min + padding) + Math.random() * (max - min - padding * 2);
      target[def.name] = Math.min(max, Math.max(min, Math.round(raw / step) * step));
    } else if (def.type === "color") {
      target[def.name] = hslToHex(Math.random() * 360, 40 + Math.random() * 50, 30 + Math.random() * 40);
    } else if (def.type === "bool") {
      target[def.name] = Math.random() > 0.5;
    } else if (def.type === "select" && def.options?.length) {
      target[def.name] = def.options[Math.floor(Math.random() * def.options.length)]!.value;
    } else if (def.type === "vec2") {
      const min = def.min ?? 0;
      const max = def.max ?? 1;
      const step = def.step ?? 0.01;
      const snap = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
      target[def.name] = [snap(min + Math.random() * (max - min)), snap(min + Math.random() * (max - min))];
    }
  }
}

function resetToDefaults() {
  for (const def of template.uniforms) {
    if (def.type === "gradient" && Array.isArray(def.default)) {
      layer.values[def.name] = (def.default as GradientStop[]).map((s) => ({ ...s }));
    } else {
      layer.values[def.name] = def.default;
    }
  }
  if (template.animationUniforms) {
    for (const def of template.animationUniforms) {
      layer.animationValues[def.name] = def.default;
    }
  }
}

// --- Value accessors ---

function getFloat(def: LayerUniformDef, target: Record<string, unknown>): number {
  return (target[def.name] as number) ?? (def.default as number);
}

function setFloat(def: LayerUniformDef, target: Record<string, unknown>, v: number) {
  target[def.name] = v;
}

function getColor(def: LayerUniformDef, target: Record<string, unknown>): string {
  return (target[def.name] as string) ?? (def.default as string);
}

function setColor(def: LayerUniformDef, target: Record<string, unknown>, v: string) {
  target[def.name] = v;
}

function getBool(def: LayerUniformDef, target: Record<string, unknown>): boolean {
  return (target[def.name] as boolean) ?? (def.default as boolean);
}

function setBool(def: LayerUniformDef, target: Record<string, unknown>, v: boolean) {
  target[def.name] = v;
}

function getGradient(def: LayerUniformDef, target: Record<string, unknown>): GradientStop[] {
  return (target[def.name] as GradientStop[]) ?? (def.default as GradientStop[]);
}

function setGradient(def: LayerUniformDef, target: Record<string, unknown>, v: GradientStop[]) {
  target[def.name] = v;
}

function getSelect(def: LayerUniformDef, target: Record<string, unknown>): string | number {
  return (target[def.name] as string | number) ?? (def.default as string | number);
}

function setSelect(def: LayerUniformDef, target: Record<string, unknown>, v: string | number) {
  target[def.name] = v;
}

function getVec2(def: LayerUniformDef, target: Record<string, unknown>): [number, number] {
  return (target[def.name] as [number, number]) ?? (def.default as [number, number]);
}

function setVec2X(def: LayerUniformDef, target: Record<string, unknown>, x: number) {
  const c = getVec2(def, target);
  target[def.name] = [x, c[1]];
}

function setVec2Y(def: LayerUniformDef, target: Record<string, unknown>, y: number) {
  const c = getVec2(def, target);
  target[def.name] = [c[0], y];
}

const hasAnimation = computed(() => {
  return template.animationUniforms && template.animationUniforms.length > 0;
});

// Distortion layer: conditionally show params based on wave type
const isDistortion = computed(() => layer.type === "distortion");
const currentWaveType = computed(() => (layer.values.waveType as number) ?? 0);

function isUniformVisible(def: LayerUniformDef): boolean {
  if (!isDistortion.value) return true;
  // Sharpness + pulseWidth only for square (1)
  if (def.name === "sharpness" || def.name === "pulseWidth") return currentWaveType.value === 1;
  // Skew only for triangle (2) and sawtooth (3)
  if (def.name === "skew") return currentWaveType.value === 2 || currentWaveType.value === 3;
  return true;
}
</script>

<template>
  <aside class="fixed bottom-4 right-4 top-4 z-40 flex w-72 flex-col overflow-hidden rounded-2xl border border-edge bg-base-1/80 shadow-2xl backdrop-blur-xl">
    <!-- Header -->
    <div class="flex shrink-0 items-center justify-between border-b border-edge px-3 py-2.5">
      <div class="flex flex-col">
        <span class="text-copy-sm font-medium text-primary select-none">{{ template.label }}</span>
        <span class="text-copy-xs text-tertiary select-none">{{ template.description }}</span>
      </div>
      <div class="flex items-center gap-0.5">
        <UiButton variant="ghost" size="sm" :icon-left="DicesIcon" title="Randomize" @click="randomizeUniforms(template.uniforms, layer.values)" />
        <UiButton variant="ghost" size="sm" :icon-left="RotateCcwIcon" title="Reset to defaults" @click="resetToDefaults" />
      </div>
    </div>

    <!-- Scrollable content -->
    <div class="flex flex-1 flex-col overflow-y-auto">
      <!-- Wave preview for distortion layers -->
      <div v-if="isDistortion" class="border-b border-edge px-3 py-3">
        <EditorWavePreview
          :wave-type="currentWaveType"
          :freq="(layer.values.freq as number) ?? 3"
          :amplitude="(layer.values.amplitude as number) ?? 0.5"
          :sharpness="(layer.values.sharpness as number) ?? 6.7"
          :pulse-width="(layer.values.pulseWidth as number) ?? 0"
          :skew="(layer.values.skew as number) ?? 0"
        />
      </div>

      <!-- Settings section -->
      <CollapsibleRoot v-model:open="settingsOpen">
        <div class="flex w-full items-center justify-between pr-2">
          <CollapsibleTrigger
            class="flex flex-1 cursor-default items-center gap-1.5 px-3 py-2 text-copy-sm font-medium text-secondary transition-colors duration-150 select-none hover:text-primary"
          >
            <ChevronRightIcon
              :class="[
                'size-3.5 text-tertiary transition-transform duration-150 ease-out-expo',
                settingsOpen && 'rotate-90',
              ]"
            />
            Settings
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent class="overflow-hidden data-[state=closed]:animate-collapse data-[state=open]:animate-expand">
          <div class="flex flex-col gap-2.5 px-3 pb-3">
            <template v-for="def in template.uniforms" :key="def.name">
              <template v-if="isUniformVisible(def)">
              <!-- Float / Int -->
              <UiSliderField
                v-if="def.type === 'float' || def.type === 'int'"
                :model-value="getFloat(def, layer.values)"
                :label="def.label"
                :min="def.min"
                :max="def.max"
                :step="def.step ?? (def.type === 'int' ? 1 : 0.01)"
                @update:model-value="setFloat(def, layer.values, $event)"
              />
              <!-- Color -->
              <UiColorField
                v-else-if="def.type === 'color'"
                :model-value="getColor(def, layer.values)"
                :label="def.label"
                @update:model-value="setColor(def, layer.values, $event)"
              />
              <!-- Bool -->
              <UiToggle
                v-else-if="def.type === 'bool'"
                :model-value="getBool(def, layer.values)"
                :label="def.label"
                @update:model-value="setBool(def, layer.values, $event)"
              />
              <!-- Gradient -->
              <UiGradientField
                v-else-if="def.type === 'gradient'"
                :model-value="getGradient(def, layer.values)"
                :label="def.label"
                @update:model-value="setGradient(def, layer.values, $event)"
              />
              <!-- Select -->
              <UiSelect
                v-else-if="def.type === 'select'"
                :model-value="getSelect(def, layer.values) as string | number"
                :options="def.options ?? []"
                :label="def.label"
                @update:model-value="setSelect(def, layer.values, $event as string | number)"
              />
              <!-- Vec2 -->
              <div v-else-if="def.type === 'vec2'" class="flex flex-col gap-2">
                <UiSliderField
                  :model-value="getVec2(def, layer.values)[0]"
                  :label="`${def.label} X`"
                  :min="def.min"
                  :max="def.max"
                  :step="def.step ?? 0.01"
                  @update:model-value="setVec2X(def, layer.values, $event)"
                />
                <UiSliderField
                  :model-value="getVec2(def, layer.values)[1]"
                  :label="`${def.label} Y`"
                  :min="def.min"
                  :max="def.max"
                  :step="def.step ?? 0.01"
                  @update:model-value="setVec2Y(def, layer.values, $event)"
                />
              </div>
              </template>
            </template>
          </div>
        </CollapsibleContent>
      </CollapsibleRoot>

      <!-- Animation section -->
      <div v-if="hasAnimation" class="flex flex-col border-t border-edge">
        <div class="flex items-center justify-between px-3 py-2">
          <span class="text-copy-sm font-medium text-secondary select-none">Animation</span>
          <div class="flex items-center gap-1">
            <div class="w-6">
              <UiButton
                v-if="layer.animationEnabled"
                variant="ghost"
                size="sm"
                :icon-left="DicesIcon"
                title="Randomize animation"
                @click="randomizeUniforms(template.animationUniforms!, layer.animationValues)"
              />
            </div>
            <UiToggle v-model="layer.animationEnabled" />
          </div>
        </div>
        <CollapsibleRoot :open="layer.animationEnabled">
          <CollapsibleContent class="overflow-hidden data-[state=closed]:animate-collapse data-[state=open]:animate-expand">
            <div class="flex flex-col gap-2.5 px-3 py-3">
              <template v-for="def in template.animationUniforms" :key="def.name">
                <UiSliderField
                  v-if="def.type === 'float' || def.type === 'int'"
                  :model-value="getFloat(def, layer.animationValues)"
                  :label="def.label"
                  :min="def.min"
                  :max="def.max"
                  :step="def.step ?? (def.type === 'int' ? 1 : 0.01)"
                  @update:model-value="setFloat(def, layer.animationValues, $event)"
                />
              </template>
            </div>
          </CollapsibleContent>
        </CollapsibleRoot>
      </div>
    </div>
  </aside>
</template>
