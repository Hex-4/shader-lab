<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from "reka-ui";
import { DownloadIcon, XIcon } from "lucide-vue-next";

type ShaderControls = {
  capture: (width: number, height: number) => Promise<void>;
  pause: () => void;
  resume: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  configureRenderer: (width: number, height: number) => void;
  restoreRenderer: () => void;
  renderFrame: (time: number) => void;
};

type Props = {
  experimentId: string;
  shader: ShaderControls | null;
};

const { experimentId, shader } = defineProps<Props>();

const open = defineModel<boolean>("open", { default: false });

const tab = ref<"image" | "video">("image");

// Image export settings
const imageResolutions = [
  { label: "1080p", width: 1920, height: 1080 },
  { label: "4K", width: 3840, height: 2160 },
  { label: "5K", width: 5120, height: 2880 },
] as const;

const selectedImageResolution = ref(0);

// Video export settings
const videoResolutions = [
  { label: "1080p", width: 1920, height: 1080 },
  { label: "2K", width: 2560, height: 1440 },
  { label: "4K", width: 3840, height: 2160 },
] as const;

const durations = [
  { label: "5s", value: 5 },
  { label: "10s", value: 10 },
  { label: "30s", value: 30 },
] as const;

const fpsOptions = [
  { label: "30", value: 30 },
  { label: "60", value: 60 },
] as const;

const selectedVideoResolution = ref(0);
const selectedDuration = ref(0);
const selectedFps = ref(0);

const { state: videoState, exportVideo, abort } = useVideoExport();

async function handleImageExport() {
  if (!shader) return;
  const res = imageResolutions[selectedImageResolution.value]!;
  open.value = false;
  await shader.capture(res.width, res.height);
}

async function handleVideoExport() {
  if (!shader) return;
  const res = videoResolutions[selectedVideoResolution.value]!;
  const dur = durations[selectedDuration.value]!;
  const fps = fpsOptions[selectedFps.value]!;

  await exportVideo(shader, {
    width: res.width,
    height: res.height,
    fps: fps.value,
    duration: dur.value,
    experimentId,
  });

  if (!videoState.exporting) {
    open.value = false;
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-contentShow" />
      <DialogContent
        class="fixed left-1/2 top-[20%] z-50 w-80 -translate-x-1/2 rounded-2xl border border-edge bg-base-1 shadow-2xl backdrop-blur-xl data-[state=open]:animate-contentShow"
      >
        <div class="flex items-center justify-between border-b border-edge px-4 py-3">
          <DialogTitle class="text-copy-sm text-primary">
            Export
          </DialogTitle>
          <UiButton variant="ghost" size="sm" :icon-left="XIcon" @click="open = false" />
        </div>

        <div class="p-4">
          <div class="flex gap-1 rounded-lg bg-surface-1 p-1">
            <button
              v-for="t in (['image', 'video'] as const)"
              :key="t"
              class="flex-1 rounded-md px-3 py-1.5 text-copy-sm capitalize transition-colors"
              :class="tab === t ? 'bg-base-1 text-primary shadow-sm' : 'text-tertiary hover:text-secondary'"
              @click="tab = t"
            >
              {{ t }}
            </button>
          </div>

          <div v-if="tab === 'image'" class="mt-4 flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <span class="text-copy-sm text-tertiary">Resolution</span>
              <div class="flex gap-1.5">
                <UiButton
                  v-for="(res, i) in imageResolutions"
                  :key="res.label"
                  variant="option"
                  :active="selectedImageResolution === i"
                  class="flex-1"
                  @click="selectedImageResolution = i"
                >
                  {{ res.label }}
                </UiButton>
              </div>
              <span class="text-copy-sm text-tertiary">
                {{ imageResolutions[selectedImageResolution]!.width }} x {{ imageResolutions[selectedImageResolution]!.height }}
              </span>
            </div>

            <UiButton variant="action" :icon-left="DownloadIcon" @click="handleImageExport">
              Download PNG
            </UiButton>
          </div>

          <div v-if="tab === 'video'" class="mt-4 flex flex-col gap-4">
            <div v-if="!videoState.exporting" class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <span class="text-copy-sm text-tertiary">Resolution</span>
                <div class="flex gap-1.5">
                  <UiButton
                    v-for="(res, i) in videoResolutions"
                    :key="res.label"
                    variant="option"
                    :active="selectedVideoResolution === i"
                    class="flex-1"
                    @click="selectedVideoResolution = i"
                  >
                    {{ res.label }}
                  </UiButton>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <span class="text-copy-sm text-tertiary">Duration</span>
                <div class="flex gap-1.5">
                  <UiButton
                    v-for="(dur, i) in durations"
                    :key="dur.label"
                    variant="option"
                    :active="selectedDuration === i"
                    class="flex-1"
                    @click="selectedDuration = i"
                  >
                    {{ dur.label }}
                  </UiButton>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <span class="text-copy-sm text-tertiary">Frame rate</span>
                <div class="flex gap-1.5">
                  <UiButton
                    v-for="(fps, i) in fpsOptions"
                    :key="fps.label"
                    variant="option"
                    :active="selectedFps === i"
                    class="flex-1"
                    @click="selectedFps = i"
                  >
                    {{ fps.label }} fps
                  </UiButton>
                </div>
              </div>

              <UiButton variant="action" :icon-left="DownloadIcon" @click="handleVideoExport">
                Render MP4
              </UiButton>
            </div>

            <div v-else class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <span class="text-copy-sm text-secondary">
                  Rendering frame {{ videoState.currentFrame }} / {{ videoState.totalFrames }}
                </span>
                <span class="text-copy-sm text-tertiary">
                  {{ Math.round(videoState.progress * 100) }}%
                </span>
              </div>

              <div class="h-1.5 overflow-hidden rounded-full bg-surface-1">
                <div
                  class="h-full rounded-full bg-secondary transition-all duration-150"
                  :style="{ width: `${videoState.progress * 100}%` }"
                />
              </div>

              <UiButton variant="action" class="text-tertiary" @click="abort">
                Cancel
              </UiButton>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
