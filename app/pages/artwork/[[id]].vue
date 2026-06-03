<script setup lang="ts">
import { PlusIcon } from "lucide-vue-next";
import { PopoverRoot, PopoverTrigger, PopoverContent, PopoverPortal } from "reka-ui";
import type {
  ArtworkDocument,
  ArtworkLayer,
  ArtworkTextLayer,
  ArtworkShaderLayer,
  ShaderDocument,
} from "#shared/types/artwork";
import {
  buildArtworkPresetDocument,
  getArtworkPreset,
  DEFAULT_ARTWORK_PRESET_ID,
} from "#shared/editor/artwork-presets";
import { cloneShaderPreset } from "#shared/editor/shader-presets";

useHead({ title: "Artwork — Shader Lab" });

const route = useRoute();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const routeId = route.params.id as string | undefined;
const presetQuery = (route.query.preset as string | undefined) ?? DEFAULT_ARTWORK_PRESET_ID;
const shaderPresetQuery = route.query.shaderPreset as string | undefined;

const { document: initialBuilt } = buildArtworkPresetDocument(
  routeId ? DEFAULT_ARTWORK_PRESET_ID : presetQuery,
);

const artworkId = ref<string | null>(routeId ?? null);
const artworkName = ref(
  routeId ? "Untitled" : (getArtworkPreset(presetQuery)?.name ?? "Untitled"),
);
const artworkDoc = ref<ArtworkDocument>(initialBuilt);
const shaderCache = ref<Record<string, ShaderDocument>>({});
const bootstrapDone = ref(!!routeId);

const selectedLayerId = ref<string | null>(
  artworkDoc.value.layers[0]?.id ?? null,
);

const selectedLayer = computed(() =>
  artworkDoc.value.layers.find((l) => l.id === selectedLayerId.value) ?? null,
);

async function loadShaderIntoCache(shaderId: string) {
  if (shaderCache.value[shaderId] || shaderId === "__pending__") return;
  try {
    const row = await $fetch(`/api/shaders/${shaderId}`) as { data: ShaderDocument };
    shaderCache.value[shaderId] = row.data;
  } catch {
    // ignore
  }
}

async function bootstrapPendingShader() {
  if (bootstrapDone.value) return;

  const layer = artworkDoc.value.layers.find(
    (l): l is ArtworkShaderLayer => l.type === "shader" && l.shaderId === "__pending__",
  );
  const shaderPresetId = shaderPresetQuery ?? getArtworkPreset(presetQuery)?.shaderPresetId ?? "blank";

  if (layer && shaderPresetId !== "blank") {
    const created = await $fetch("/api/shaders", {
      method: "POST",
      body: {
        name: getArtworkPreset(presetQuery)?.name ?? "Background",
        data: cloneShaderPreset(shaderPresetId),
      },
    }) as { id: string; data: ShaderDocument };
    layer.shaderId = created.id;
    shaderCache.value[created.id] = created.data;
  }

  bootstrapDone.value = true;
}

if (routeId) {
  const { data } = await useFetch(`/api/artworks/${routeId}`);
  if (data.value) {
    const row = data.value as { id: string; name: string; data: ArtworkDocument };
    artworkId.value = row.id;
    artworkName.value = row.name;
    artworkDoc.value = row.data;
    bootstrapDone.value = true;
    for (const layer of row.data.layers) {
      if (layer.type === "shader") {
        await loadShaderIntoCache(layer.shaderId);
      }
    }
  }
} else {
  await bootstrapPendingShader();
}

const artworkData = computed(() => artworkDoc.value);

const { getDisplayCanvas } = useArtworkPreview(canvasRef, artworkDoc, shaderCache);

const saveEnabled = computed(() => bootstrapDone.value);

useAutoSave(artworkId, artworkName, artworkData, {
  kind: "artwork",
  getCanvas: () => getDisplayCanvas(),
  enabled: saveEnabled,
});

watch(
  () => artworkDoc.value.layers,
  (layers) => {
    for (const layer of layers) {
      if (layer.type === "shader") {
        loadShaderIntoCache(layer.shaderId);
      }
    }
  },
  { deep: true, immediate: true },
);

const pickerOpen = ref(false);

function addTextLayer() {
  const id = `text-${Date.now()}`;
  artworkDoc.value.layers.unshift({
    id,
    type: "text",
    enabled: true,
    content: "Your headline",
    fontFamily: "system-ui",
    fontSize: 48,
    color: "#ffffff",
    x: 0.5,
    y: 0.55,
    align: "center",
    opacity: 1,
  });
  selectedLayerId.value = id;
  pickerOpen.value = false;
}

function removeLayer(id: string) {
  const idx = artworkDoc.value.layers.findIndex((l) => l.id === id);
  if (idx === -1) return;
  artworkDoc.value.layers.splice(idx, 1);
  if (selectedLayerId.value === id) {
    selectedLayerId.value = artworkDoc.value.layers[0]?.id ?? null;
  }
}

function editShaderLayer(layer: ArtworkShaderLayer) {
  if (layer.shaderId === "__pending__") return;
  navigateTo({
    path: `/shader/${layer.shaderId}`,
    query: artworkId.value ? { fromArtwork: artworkId.value } : {},
  });
}

function layerLabel(layer: ArtworkLayer): string {
  if (layer.type === "shader") return "Shader";
  if (layer.type === "text") return "Text";
  return "Image";
}

const selectedText = computed(() =>
  selectedLayer.value?.type === "text" ? selectedLayer.value as ArtworkTextLayer : null,
);
</script>

<template>
  <div class="h-dvh overflow-hidden">
    <ClientOnly>
      <div class="fixed inset-0 flex items-center justify-center bg-base-0 p-16 pt-20 pb-8">
        <canvas
          ref="canvasRef"
          class="max-h-full max-w-full rounded-xl border border-edge shadow-2xl"
          :style="{ aspectRatio: `${artworkDoc.canvas.width} / ${artworkDoc.canvas.height}` }"
        />
      </div>

      <div class="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-edge bg-base-1/80 px-3 py-1.5 shadow-2xl backdrop-blur-xl">
        <NuxtLink to="/" class="text-copy-sm text-tertiary transition-colors duration-150 hover:text-primary">
          Shader Lab
        </NuxtLink>
        <div class="h-4 w-px bg-surface-1" />
        <UiEditableText v-model="artworkName" fill class="text-copy-sm text-secondary" />
        <span class="text-copy-xs text-tertiary select-none">
          {{ artworkDoc.canvas.width }}×{{ artworkDoc.canvas.height }}
        </span>
      </div>

      <!-- Layer stack -->
      <div class="fixed bottom-4 left-4 top-4 z-40 flex w-56 flex-col">
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-edge bg-base-1/80 shadow-2xl backdrop-blur-xl">
          <div class="flex shrink-0 items-center justify-between border-b border-edge px-3 py-2.5">
            <span class="text-copy-sm font-medium text-primary select-none">Layers</span>
            <PopoverRoot v-model:open="pickerOpen">
              <PopoverTrigger as-child>
                <button class="flex size-6 cursor-default items-center justify-center rounded-md text-tertiary transition-colors duration-150 hover:bg-surface-1 hover:text-secondary">
                  <PlusIcon class="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverContent
                  side="right"
                  :side-offset="12"
                  class="z-50 rounded-xl border border-edge bg-base-1 p-2 shadow-2xl"
                >
                  <button
                    type="button"
                    class="w-full rounded-lg px-2 py-1.5 text-left text-copy-sm text-primary hover:bg-surface-1"
                    @click="addTextLayer"
                  >
                    Text
                  </button>
                </PopoverContent>
              </PopoverPortal>
            </PopoverRoot>
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <button
              v-for="layer in artworkDoc.layers"
              :key="layer.id"
              type="button"
              class="mb-1 flex w-full cursor-default items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors duration-150"
              :class="selectedLayerId === layer.id ? 'bg-surface-1 text-primary' : 'text-secondary hover:bg-surface-1/60'"
              @click="selectedLayerId = layer.id"
            >
              <span class="text-copy-sm">{{ layerLabel(layer) }}</span>
              <span
                v-if="!layer.enabled"
                class="text-copy-xs text-tertiary"
              >Off</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Inspector -->
      <aside
        v-if="selectedLayer"
        class="fixed bottom-4 right-4 top-4 z-40 flex w-72 flex-col overflow-hidden rounded-2xl border border-edge bg-base-1/80 shadow-2xl backdrop-blur-xl"
      >
        <div class="border-b border-edge px-3 py-2.5">
          <span class="text-copy-sm font-medium text-primary">{{ layerLabel(selectedLayer) }}</span>
        </div>
        <div class="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
          <template v-if="selectedLayer.type === 'shader'">
            <p class="text-copy-xs text-tertiary">
              Background shader for this artwork.
            </p>
            <UiButton
              variant="action"
              :disabled="selectedLayer.shaderId === '__pending__'"
              @click="editShaderLayer(selectedLayer)"
            >
              Edit shader
            </UiButton>
          </template>
          <template v-else-if="selectedText">
            <UiSliderField
              v-model="selectedText.x"
              label="X"
              :min="0"
              :max="1"
              :step="0.01"
            />
            <UiSliderField
              v-model="selectedText.y"
              label="Y"
              :min="0"
              :max="1"
              :step="0.01"
            />
            <UiSliderField
              v-model="selectedText.fontSize"
              label="Size"
              :min="12"
              :max="120"
              :step="1"
            />
            <UiColorField v-model="selectedText.color" label="Color" />
            <label class="flex flex-col gap-1">
              <span class="text-copy-xs text-tertiary">Content</span>
              <textarea
                v-model="selectedText.content"
                rows="3"
                class="rounded-lg border border-edge bg-surface-1 px-2 py-1.5 text-copy-sm text-primary"
              />
            </label>
          </template>
          <UiButton variant="ghost" size="sm" @click="removeLayer(selectedLayer.id)">
            Remove layer
          </UiButton>
        </div>
      </aside>
    </ClientOnly>
  </div>
</template>
