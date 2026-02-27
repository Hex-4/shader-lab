import type { LayerInstance, LFOSource, ModulationAssignment } from "#shared/types/editor";
import { useDebounceFn } from "@vueuse/core";

type CompositionData = {
  version: 1;
  layers: LayerInstance[];
  lfos: LFOSource[];
  assignments: ModulationAssignment[];
};

export function useAutoSave(
  compositionId: Ref<string | null>,
  compositionName: Ref<string>,
  data: Ref<CompositionData>,
  getCanvas?: () => HTMLCanvasElement | null,
) {
  let hasCapturedThumbnail = false;

  async function save() {
    try {
      if (!compositionId.value) {
        const result = await $fetch("/api/compositions", {
          method: "POST",
          body: { name: compositionName.value, data: toRaw(data.value) },
        });
        compositionId.value = (result as { id: string }).id;
        history.replaceState(null, "", `/editor/${compositionId.value}`);
      } else {
        await $fetch(`/api/compositions/${compositionId.value}`, {
          method: "PATCH",
          body: { name: compositionName.value, data: toRaw(data.value) },
        });
      }

      // Capture thumbnail on first save, then every 30 seconds
      if (!hasCapturedThumbnail) {
        hasCapturedThumbnail = true;
        setTimeout(() => captureThumbnail(), 500);
      }
    } catch (e) {
      console.error("Auto-save failed:", e);
    }
  }

  async function captureThumbnail() {
    if (!compositionId.value || !getCanvas) return;
    const canvas = getCanvas();
    if (!canvas) return;

    try {
      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = 400;
      thumbCanvas.height = 300;
      const ctx = thumbCanvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(canvas, 0, 0, 400, 300);

      const blob = await new Promise<Blob | null>((resolve) => {
        thumbCanvas.toBlob(resolve, "image/png");
      });
      if (!blob) return;

      const formData = new FormData();
      formData.append("file", blob, "thumbnail.png");

      await $fetch(`/api/compositions/${compositionId.value}/thumbnail`, {
        method: "POST",
        body: formData,
      });
    } catch {
      // Best-effort
    }
  }

  const debouncedSave = useDebounceFn(save, 300);

  // Save immediately for new compositions
  onMounted(() => {
    if (!compositionId.value) {
      save();
    }
  });

  watch(data, () => debouncedSave(), { deep: true });
  watch(compositionName, () => debouncedSave());
}
