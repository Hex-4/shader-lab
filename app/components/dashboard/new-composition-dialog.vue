<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from "reka-ui";
import { XIcon } from "lucide-vue-next";
import { COMPOSITION_PRESETS } from "#shared/editor/composition-presets";

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
  select: [presetId: string];
}>();

function choose(presetId: string) {
  emit("select", presetId);
  open.value = false;
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-contentShow" />
      <DialogContent
        class="fixed left-1/2 top-[10%] z-50 flex max-h-[min(85dvh,820px)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 flex-col rounded-2xl border border-edge bg-base-1 shadow-2xl backdrop-blur-xl data-[state=open]:animate-contentShow"
      >
        <div class="flex shrink-0 items-center justify-between border-b border-edge px-4 py-3">
          <DialogTitle class="text-copy-sm font-medium text-primary">
            New composition
          </DialogTitle>
          <UiButton variant="ghost" size="sm" :icon-left="XIcon" @click="open = false" />
        </div>

        <div class="overflow-y-auto p-4">
          <div
            v-if="open"
            class="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <DashboardPresetCard
              v-for="preset in COMPOSITION_PRESETS"
              :key="preset.id"
              :preset="preset"
              :active="open"
              @select="choose(preset.id)"
            />
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
