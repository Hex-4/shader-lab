import type { InjectionKey } from "vue";
import type { ArtworkDocument, ArtworkTextLayer } from "#shared/types/artwork";
import type { ArtworkTextRunStyle } from "#shared/artwork/text-layer";
import {
  applyStyleToRange,
  getTextRuns,
  setLayerRuns,
} from "#shared/artwork/text-layer";

export type ArtworkTextEditApi = ReturnType<typeof useArtworkTextEdit>;

export const ArtworkTextEditKey: InjectionKey<ArtworkTextEditApi> = Symbol("artwork-text-edit");

export function useArtworkTextEdit(
  artwork: Ref<ArtworkDocument>,
  selectedLayerId: Ref<string | null>,
) {
  const editingLayerId = ref<string | null>(null);
  const selection = ref({ start: 0, end: 0 });

  const editingLayer = computed(() => {
    const id = editingLayerId.value;
    if (!id) return null;
    const layer = artwork.value.layers.find((l) => l.id === id);
    return layer?.type === "text" ? layer : null;
  });

  function startEditing(layerId: string) {
    editingLayerId.value = layerId;
    selectedLayerId.value = layerId;
    selection.value = { start: 0, end: 0 };
  }

  function stopEditing() {
    editingLayerId.value = null;
  }

  function updateSelection(start: number, end: number) {
    selection.value = {
      start: Math.max(0, start),
      end: Math.max(0, end),
    };
  }

  function applyToSelection(patch: ArtworkTextRunStyle, layer?: ArtworkTextLayer) {
    const target = layer ?? editingLayer.value
      ?? (selectedLayerId.value
        ? artwork.value.layers.find((l) => l.id === selectedLayerId.value && l.type === "text")
        : null);
    if (!target || target.type !== "text") return;

    const { start, end } = selection.value;
    if (start === end && editingLayerId.value !== target.id) return;

    const runs = getTextRuns(target);
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    if (lo === hi && !patch) return;

    setLayerRuns(target, applyStyleToRange(runs, lo, hi || lo + 1, patch));
  }

  function toggleBold(layer?: ArtworkTextLayer) {
    applyToSelection({ bold: true }, layer);
  }

  function toggleItalic(layer?: ArtworkTextLayer) {
    applyToSelection({ italic: true }, layer);
  }

  function toggleUnderline(layer?: ArtworkTextLayer) {
    applyToSelection({ underline: true }, layer);
  }

  function setSelectionColor(color: string, layer?: ArtworkTextLayer) {
    applyToSelection({ color }, layer);
  }

  watch(selectedLayerId, (id) => {
    if (editingLayerId.value && id !== editingLayerId.value) {
      stopEditing();
    }
  });

  return {
    editingLayerId,
    editingLayer,
    selection,
    startEditing,
    stopEditing,
    updateSelection,
    applyToSelection,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    setSelectionColor,
  };
}
