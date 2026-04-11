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

/** Build uniforms for a layer from its template and values. */
function buildUniforms(
  layer: LayerInstance,
  modFn: ModulationFn | null,
): Record<string, unknown> {
  const template = LAYER_TEMPLATES[layer.type];
  if (!template) return {};

  const uniforms: Record<string, unknown> = {};
  for (const def of template.uniforms) {
    let value = layer.values[def.name] ?? def.default;
    if (modFn && typeof value === "number") {
      value = modFn(layer.id, def.name, value);
    }
    uniforms[def.name] = value;
  }
  return uniforms;
}

/**
 * Detect distortion groups — consecutive distortion layers with the same groupId.
 * Returns an array of groups, where each group is an array of layer indices (in render order).
 */
function findDistortionGroups(enabled: LayerInstance[]): Map<string, number[]> {
  const groups = new Map<string, number[]>();

  for (let i = 0; i < enabled.length; i++) {
    const layer = enabled[i]!;
    if (layer.type !== "distortion" || !layer.groupId) continue;

    const existing = groups.get(layer.groupId);
    if (existing) {
      existing.push(i);
    } else {
      groups.set(layer.groupId, [i]);
    }
  }

  // Only keep groups with 2+ members
  for (const [key, indices] of groups) {
    if (indices.length < 2) groups.delete(key);
  }

  return groups;
}

function compilePasses(
  layers: LayerInstance[],
  modFn: ModulationFn | null,
): RenderPass[] {
  // Layers are stored in visual order (top → bottom).
  // Reverse so compilation runs bottom → top (render order).
  const enabled = [...layers].reverse().filter((l) => l.enabled);
  if (enabled.length === 0) return [];

  const groups = findDistortionGroups(enabled);

  // Build a set of layer indices that belong to any group
  const groupedIndices = new Set<number>();
  const groupByIndex = new Map<number, string>();
  for (const [groupId, indices] of groups) {
    for (const idx of indices) {
      groupedIndices.add(idx);
      groupByIndex.set(idx, groupId);
    }
  }

  const result: RenderPass[] = [];
  let previousLayerId: string | null = null;
  const processedGroups = new Set<string>();

  for (let i = 0; i < enabled.length; i++) {
    const layer = enabled[i]!;
    const template = LAYER_TEMPLATES[layer.type];
    if (!template) continue;

    const isLast = i === enabled.length - 1;
    const isGenerator = template.category === "generator";
    const groupId = groupByIndex.get(i);

    // Check if this layer is part of a displacement group
    if (groupId && !processedGroups.has(groupId)) {
      processedGroups.add(groupId);
      const groupIndices = groups.get(groupId)!;

      // The color source is whatever was rendered before this group
      const colorSourceLayerId = previousLayerId;

      // Emit displacement passes for each distortion in the group
      let prevDisplacementLayerId: string | null = null;

      for (let g = 0; g < groupIndices.length; g++) {
        const gIdx = groupIndices[g]!;
        const gLayer = enabled[gIdx]!;
        const gUniforms = buildUniforms(gLayer, modFn);

        // Set output mode to displacement
        gUniforms.outputMode = 1;

        // First distortion in group has no displacement input — needs a "zero" displacement
        // We pass null as input and the shader reads (0.5, 0.5) = zero displacement
        const inputId = g === 0 ? null : prevDisplacementLayerId;

        result.push({
          layerId: gLayer.id,
          layerType: gLayer.type,
          uniforms: gUniforms,
          inputLayerId: inputId,
          isOutput: false,
        });

        prevDisplacementLayerId = gLayer.id;
      }

      // Emit a resolve pass that samples the color at the displaced UVs
      const resolveId = `resolve-${groupId}`;
      const isResolveOutput = isLast || groupIndices.includes(enabled.length - 1);

      result.push({
        layerId: resolveId,
        layerType: "resolve",
        uniforms: {},
        inputLayerId: prevDisplacementLayerId, // displacement map
        colorSourceLayerId, // the generator's color output
        isOutput: isResolveOutput,
      });

      previousLayerId = resolveId;
      continue;
    }

    // Skip individual layers that are part of a group (already processed above)
    if (groupedIndices.has(i)) continue;

    // Normal layer (generator, effect, or ungrouped distortion)
    const uniforms = buildUniforms(layer, modFn);

    // Ungrouped distortion: ensure outputMode is 0 (color mode)
    if (layer.type === "distortion") {
      uniforms.outputMode = 0;
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
