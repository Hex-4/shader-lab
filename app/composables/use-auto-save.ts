import { useDebounceFn } from "@vueuse/core";

export type AutoSaveKind = "shader" | "artwork";

type AutoSaveOptions = {
  kind: AutoSaveKind;
  getCanvas?: () => HTMLCanvasElement | null;
  /** When false, skips initial POST on mount (e.g. artwork bootstrap). */
  enabled?: Ref<boolean>;
};

export function useAutoSave(
  documentId: Ref<string | null>,
  documentName: Ref<string>,
  data: Ref<unknown>,
  options: AutoSaveOptions,
) {
  const apiBase = options.kind === "shader" ? "/api/shaders" : "/api/artworks";
  const editorPath = options.kind === "shader" ? "/shader" : "/artwork";

  let hasCapturedThumbnail = false;

  async function save() {
    try {
      if (!documentId.value) {
        const result = await $fetch(apiBase, {
          method: "POST",
          body: { name: documentName.value, data: toRaw(data.value) },
        });
        documentId.value = (result as { id: string }).id;
        history.replaceState(null, "", `${editorPath}/${documentId.value}`);
      } else {
        await $fetch(`${apiBase}/${documentId.value}`, {
          method: "PATCH",
          body: { name: documentName.value, data: toRaw(data.value) },
        });
      }

      if (!hasCapturedThumbnail && options.getCanvas) {
        hasCapturedThumbnail = true;
        setTimeout(() => captureThumbnail(), 500);
      }
    } catch (e) {
      console.error("Auto-save failed:", e);
    }
  }

  async function captureThumbnail() {
    if (!documentId.value || !options.getCanvas) return;
    const canvas = options.getCanvas();
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

      await $fetch(`${apiBase}/${documentId.value}/thumbnail`, {
        method: "POST",
        body: formData,
      });
    } catch {
      // Best-effort
    }
  }

  const debouncedSave = useDebounceFn(save, 300);

  const enabled = options.enabled ?? ref(true);

  onMounted(() => {
    if (!documentId.value && enabled.value) {
      save();
    }
  });

  watch(data, () => {
    if (enabled.value) debouncedSave();
  }, { deep: true });
  watch(documentName, () => {
    if (enabled.value) debouncedSave();
  });
  watch(enabled, (ok) => {
    if (ok && !documentId.value) save();
  });

  return { save };
}
