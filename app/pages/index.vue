<script setup lang="ts">
import { PlusIcon } from "lucide-vue-next";

useHead({ title: "Shader Lab" });

const { data: compositions, refresh } = await useFetch("/api/compositions");

// Thumbnails are captured client-side from the editor and uploaded on save

async function createNew() {
  navigateTo("/editor");
}

async function deleteComposition(id: string) {
  await $fetch(`/api/compositions/${id}`, { method: "DELETE" });
  await refresh();
}

async function duplicateComposition(id: string) {
  const source = compositions.value?.find((c: any) => c.id === id) as any;
  if (!source) return;
  await $fetch("/api/compositions", {
    method: "POST",
    body: { name: `${source.name} Copy`, data: source.data },
  });
  await refresh();
}
</script>

<template>
  <div class="min-h-dvh bg-base-0">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-edge px-6 py-4">
      <h1 class="text-title-sm font-semibold text-primary select-none">Shader Lab</h1>
      <div class="flex items-center gap-3">
        <UiButton variant="action" :icon-left="PlusIcon" @click="createNew">
          New
        </UiButton>
        <DashboardUserMenu />
      </div>
    </header>

    <!-- Content -->
    <main class="mx-auto max-w-5xl px-6 py-8">
      <!-- Empty state -->
      <div
        v-if="!compositions?.length"
        class="flex flex-col items-center justify-center gap-4 py-24"
      >
        <p class="text-copy-sm text-tertiary">No compositions yet.</p>
        <UiButton variant="action" :icon-left="PlusIcon" @click="createNew">
          Create your first shader
        </UiButton>
      </div>

      <!-- Composition grid -->
      <div
        v-else
        class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <DashboardCompositionCard
          v-for="comp in (compositions as any[])"
          :key="comp.id"
          :id="comp.id"
          :name="comp.name"
          :thumbnail-url="comp.thumbnailUrl"
          :updated-at="comp.updatedAt"
          :data="comp.data"
          @delete="deleteComposition(comp.id)"
          @duplicate="duplicateComposition(comp.id)"
        />
      </div>
    </main>
  </div>
</template>
