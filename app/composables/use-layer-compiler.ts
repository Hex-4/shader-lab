import type { Ref, ComputedRef } from "vue";
import type { LayerInstance, RenderPass } from "#shared/types/editor";
import LAYER_TEMPLATES from "#shared/editor/layer-templates";

type ModulationFn = (
  layerId: string,
  paramName: string,
  baseValue: number,
) => number;

export function useLayerCompiler(
  layers: Ref<LayerInstance[]>,
  getModulatedValue?: Ref<ModulationFn | null>,
) {
  const passes = computed<RenderPass[]>(() =>
    compilePasses(layers.value, getModulatedValue?.value ?? null),
  );
  return { passes };
}

function compilePasses(
  layers: LayerInstance[],
  modFn: ModulationFn | null,
): RenderPass[] {
  // Layers are stored in visual order (top → bottom).
  // Reverse so compilation runs bottom → top (render order).
  const enabled = [...layers].reverse().filter((l) => l.enabled);
  if (enabled.length === 0) return [];

  const result: RenderPass[] = [];
  let previousLayerId: string | null = null;

  for (let i = 0; i < enabled.length; i++) {
    const layer = enabled[i]!;
    const template = LAYER_TEMPLATES[layer.type];
    if (!template) continue;

    const isLast = i === enabled.length - 1;
    const isGenerator = template.category === "generator";

    const uniforms: Record<string, unknown> = {};

    for (const def of template.uniforms) {
      let value = layer.values[def.name] ?? def.default;

      // Apply modulation to numeric values
      if (modFn && typeof value === "number") {
        value = modFn(layer.id, def.name, value);
      }

      uniforms[def.name] = value;
    }

    result.push({
      layerId: layer.id,
      layerType: layer.type,
      uniforms,
      inputLayerId: isGenerator ? null : previousLayerId,
      isOutput: isLast,
    });

    previousLayerId = layer.id;
  }

  return result;
}
