<script setup lang="ts">
import type { ArtworkDocument } from "#shared/types/artwork";

const props = defineProps<{
  id: string;
  name: string;
  thumbnailUrl: string | null;
  updatedAt: string;
  data: ArtworkDocument;
}>();

const emit = defineEmits<{
  delete: [];
  duplicate: [];
}>();

const relativeTime = computed(() => {
  const now = Date.now();
  const then = new Date(props.updatedAt).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(props.updatedAt).toLocaleDateString();
});
</script>

<template>
  <UiContextMenu>
    <NuxtLink :to="`/artwork/${props.id}`" class="block">
      <div class="flex flex-col gap-2.5">
        <div
          class="relative aspect-video w-full overflow-hidden rounded-2xl border border-edge bg-base-0"
        >
          <img
            v-if="props.thumbnailUrl"
            :src="props.thumbnailUrl"
            :alt="props.name"
            class="size-full object-cover"
          />
          <div v-else class="flex size-full items-center justify-center">
            <span class="text-copy-xs text-tertiary">Artwork</span>
          </div>
        </div>
        <div class="flex min-w-0 flex-col gap-0.5 px-3">
          <span class="truncate text-copy-sm font-medium text-primary">{{ props.name }}</span>
          <span class="text-copy-xs text-tertiary">{{ relativeTime }}</span>
        </div>
      </div>
    </NuxtLink>
    <template #menu>
      <UiContextMenuItem @click="emit('duplicate')">Duplicate</UiContextMenuItem>
      <UiContextMenuSeparator />
      <UiContextMenuItem @click="emit('delete')">Delete</UiContextMenuItem>
    </template>
  </UiContextMenu>
</template>
