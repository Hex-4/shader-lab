<script setup lang="ts">
useHead({ title: "Shader Lab" });

type LibraryTab = "shaders" | "artworks";

const tab = ref<LibraryTab>("artworks");

const { data: shaders, refresh: refreshShaders } = await useFetch("/api/shaders");
const { data: artworks, refresh: refreshArtworks } = await useFetch("/api/artworks");

async function refresh() {
  await Promise.all([refreshShaders(), refreshArtworks()]);
}

async function deleteShader(id: string) {
  await $fetch(`/api/shaders/${id}`, { method: "DELETE" });
  await refresh();
}

async function deleteArtwork(id: string) {
  await $fetch(`/api/artworks/${id}`, { method: "DELETE" });
  await refresh();
}

async function duplicateShader(id: string) {
  const source = (shaders.value as any[])?.find((s) => s.id === id);
  if (!source) return;
  await $fetch("/api/shaders", {
    method: "POST",
    body: { name: `${source.name} Copy`, data: source.data },
  });
  await refresh();
}

async function duplicateArtwork(id: string) {
  const source = (artworks.value as any[])?.find((a) => a.id === id);
  if (!source) return;
  await $fetch("/api/artworks", {
    method: "POST",
    body: { name: `${source.name} Copy`, data: source.data },
  });
  await refresh();
}

const isEmpty = computed(() => {
  if (tab.value === "shaders") return !(shaders.value as any[])?.length;
  return !(artworks.value as any[])?.length;
});
</script>

<template>
  <div class="min-h-dvh bg-base-0">
    <header class="sticky top-0 z-10 flex items-center justify-between border-b border-edge bg-base-0/80 px-6 py-4 backdrop-blur-xl">
      <h1 class="text-copy-sm text-primary select-none">Shader Lab</h1>
      <div class="flex items-center gap-3">
        <DashboardNewMenu />
        <DashboardUserMenu />
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-6 py-8">
      <div class="mb-6 flex gap-1 rounded-lg bg-surface-1 p-1">
        <button
          type="button"
          class="flex-1 rounded-md px-3 py-1.5 text-copy-sm transition-colors duration-150"
          :class="tab === 'artworks' ? 'bg-base-1 text-primary shadow-sm' : 'text-tertiary hover:text-secondary'"
          @click="tab = 'artworks'"
        >
          Artworks
        </button>
        <button
          type="button"
          class="flex-1 rounded-md px-3 py-1.5 text-copy-sm transition-colors duration-150"
          :class="tab === 'shaders' ? 'bg-base-1 text-primary shadow-sm' : 'text-tertiary hover:text-secondary'"
          @click="tab = 'shaders'"
        >
          Shaders
        </button>
      </div>

      <div
        v-if="isEmpty"
        class="flex flex-col items-center justify-center gap-4 py-24"
      >
        <p class="text-copy-sm text-tertiary">
          {{ tab === 'artworks' ? 'No artworks yet.' : 'No shaders yet.' }}
        </p>
      </div>

      <div
        v-else-if="tab === 'shaders'"
        class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <DashboardShaderCard
          v-for="item in (shaders as any[])"
          :key="item.id"
          :id="item.id"
          :name="item.name"
          :thumbnail-url="item.thumbnailUrl"
          :updated-at="item.updatedAt"
          :data="item.data"
          @delete="deleteShader(item.id)"
          @duplicate="duplicateShader(item.id)"
        />
      </div>

      <div
        v-else
        class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <DashboardArtworkCard
          v-for="item in (artworks as any[])"
          :key="item.id"
          :id="item.id"
          :name="item.name"
          :thumbnail-url="item.thumbnailUrl"
          :updated-at="item.updatedAt"
          :data="item.data"
          @delete="deleteArtwork(item.id)"
          @duplicate="duplicateArtwork(item.id)"
        />
      </div>
    </main>
  </div>
</template>
