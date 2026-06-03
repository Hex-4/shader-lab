<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-base-0">
    <header
      v-if="$slots.header"
      class="flex shrink-0 items-center gap-3 border-b border-edge bg-base-1 px-4 py-2.5"
    >
      <slot name="header" />
    </header>

    <div class="flex min-h-0 flex-1">
      <aside
        v-if="$slots.left"
        class="flex w-56 shrink-0 flex-col overflow-hidden border-r border-edge bg-base-1"
      >
        <slot name="left" />
      </aside>

      <main class="relative flex min-h-0 min-w-0 flex-1 flex-col bg-base-0">
        <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <slot />
        </div>
        <footer
          v-if="$slots.footer"
          class="flex shrink-0 flex-col gap-2 border-t border-edge bg-base-1 px-4 py-3"
        >
          <slot name="footer" />
        </footer>
      </main>

      <aside
        v-if="$slots.right"
        class="flex w-72 shrink-0 flex-col overflow-hidden border-l border-edge bg-base-1"
      >
        <slot name="right" />
      </aside>
    </div>
  </div>
</template>
