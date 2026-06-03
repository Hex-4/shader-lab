import type { Ref, ComputedRef } from "vue";
import type { LayerInstance, LFOSource, ModulationAssignment } from "#shared/types/editor";
import { compilePasses, type ModulationFn } from "#shared/editor/compile-passes";

export function useLayerCompiler(
  layers: Ref<LayerInstance[]>,
  getModulatedValue?: Ref<ModulationFn | null>,
  lfos?: Ref<LFOSource[]>,
  assignments?: Ref<ModulationAssignment[]>,
) {
  const compileGeneration = ref(0);

  watch(layers, () => {
    compileGeneration.value++;
  }, { deep: true });

  if (lfos) {
    watch(lfos, () => {
      compileGeneration.value++;
    }, { deep: true });
  }

  if (assignments) {
    watch(assignments, () => {
      compileGeneration.value++;
    }, { deep: true });
  }

  const passes = computed(() => {
    compileGeneration.value;
    return compilePasses(layers.value, getModulatedValue?.value ?? null);
  });

  return { passes };
}
