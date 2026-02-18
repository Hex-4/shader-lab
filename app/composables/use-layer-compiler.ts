import type { LayerInstance, RenderPass } from "#shared/types/editor";
import LAYER_TEMPLATES from "#shared/editor/layer-templates";

export function useLayerCompiler(layers: Ref<LayerInstance[]>) {
  const passes = computed<RenderPass[]>(() => compilePasses(layers.value));
  return { passes };
}

function compilePasses(layers: LayerInstance[]): RenderPass[] {
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

    // Build uniforms: merge layer values with animation values
    const uniforms: Record<string, unknown> = {};

    // Main uniforms — use layer values, fall back to template defaults
    for (const def of template.uniforms) {
      uniforms[def.name] = layer.values[def.name] ?? def.default;
    }

    // Animation uniforms — if animation is enabled, use animation values;
    // otherwise use defaults that produce no animation (speed: 0, drift: 0)
    if (template.animationUniforms) {
      for (const def of template.animationUniforms) {
        if (layer.animationEnabled) {
          uniforms[def.name] = layer.animationValues[def.name] ?? def.default;
        } else {
          // When animation is disabled, set speed to 0 and drift to 0
          uniforms[def.name] =
            def.name === "speed" || def.name === "drift" ? 0 : def.default;
        }
      }
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
