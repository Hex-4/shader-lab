<script setup lang="ts">
import type { ArtworkCanvas, ArtworkTextLayer } from "#shared/types/artwork";
import {
  editorStyleFromLayer,
  getTextRuns,
  parseEditorElement,
  runsToEditorHtml,
  setLayerRuns,
  textEditorAnchorStyle,
} from "#shared/artwork/text-layer";

const props = defineProps<{
  layer: ArtworkTextLayer;
  canvas: ArtworkCanvas;
  /** stage.clientHeight / canvas.height */
  displayScale: number;
}>();

const emit = defineEmits<{
  selection: [start: number, end: number];
  commit: [];
}>();

const editorRef = ref<HTMLDivElement | null>(null);
const measureCtx = shallowRef<CanvasRenderingContext2D | null>(null);

const anchorStyle = computed(() => {
  const ctx = measureCtx.value;
  if (!ctx) return {};
  return textEditorAnchorStyle(props.layer, props.canvas, ctx);
});

const editorCss = computed(() =>
  editorStyleFromLayer(props.layer, props.canvas.height, props.displayScale),
);

onMounted(() => {
  const c = document.createElement("canvas");
  measureCtx.value = c.getContext("2d");

  nextTick(() => {
    const el = editorRef.value;
    if (!el) return;
    el.innerHTML = runsToEditorHtml(props.layer, getTextRuns(props.layer));
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    syncSelection();
  });
});

watch(
  () => [props.layer, props.displayScale],
  () => {
    const el = editorRef.value;
    if (!el || document.activeElement === el) return;
    el.innerHTML = runsToEditorHtml(props.layer, getTextRuns(props.layer));
  },
);

function syncSelection() {
  const el = editorRef.value;
  if (!el) return;

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
    emit("selection", 0, 0);
    return;
  }

  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(sel.anchorNode!, sel.anchorOffset);
  const start = pre.toString().length;

  const preEnd = document.createRange();
  preEnd.selectNodeContents(el);
  preEnd.setEnd(sel.focusNode!, sel.focusOffset);
  const end = preEnd.toString().length;

  emit("selection", start, end);
}

function onInput() {
  const el = editorRef.value;
  if (!el) return;
  setLayerRuns(props.layer, parseEditorElement(el, props.layer));
  syncSelection();
}

function onBlur() {
  const el = editorRef.value;
  if (el) {
    setLayerRuns(props.layer, parseEditorElement(el, props.layer));
  }
  emit("commit");
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    (e.target as HTMLElement).blur();
  }
}
</script>

<template>
  <div
    class="pointer-events-auto absolute z-30 outline-none"
    :style="anchorStyle"
  >
    <div
      ref="editorRef"
      contenteditable="true"
      class="outline-none"
      :style="editorCss"
      @input="onInput"
      @blur="onBlur"
      @keyup="syncSelection"
      @mouseup="syncSelection"
      @keydown="onKeydown"
    />
  </div>
</template>
