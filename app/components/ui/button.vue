<script setup lang="ts">
import type { Component } from "vue";

defineOptions({ inheritAttrs: false });

type Variant = "toolbar" | "action" | "option" | "ghost";
type Size = "sm" | "md";

type Props = {
  variant?: Variant;
  size?: Size;
  active?: boolean;
  iconLeft?: Component;
  iconRight?: Component;
};

const { variant = "toolbar", size = "md", active = false } = defineProps<Props>();

const slots = useSlots();

const classes = computed(() => {
  const base = "flex items-center justify-center transition-colors";

  const radius = "rounded-lg";

  const variantClasses: Record<Variant, string> = {
    toolbar: `${radius} border border-edge bg-base-1 text-secondary shadow-lg backdrop-blur-xl hover:bg-surface-1 hover:text-primary`,
    action: `${radius} bg-surface-2 text-primary hover:bg-surface-3`,
    option: active
      ? `${radius} bg-surface-2 text-primary ring-1 ring-edge`
      : `${radius} bg-surface-1 text-tertiary hover:text-secondary`,
    ghost: `${radius} text-tertiary hover:bg-surface-1 hover:text-secondary`,
  };

  const sizeClasses: Record<Size, string> = {
    sm: "h-8 text-copy-sm",
    md: "h-8 text-copy-sm",
  };

  const hasContent = !!slots.default;
  const widthClass = hasContent
    ? (variant === "option" ? "px-3 py-1.5" : "gap-2 px-3")
    : "w-8";

  return [base, variantClasses[variant], sizeClasses[size], widthClass];
});
</script>

<template>
  <button v-bind="$attrs" :class="classes">
    <component v-if="iconLeft" :is="iconLeft" :class="size === 'sm' ? 'size-3.5 shrink-0' : 'size-4 shrink-0'" />
    <slot />
    <component v-if="iconRight" :is="iconRight" :class="size === 'sm' ? 'size-3.5 shrink-0' : 'size-4 shrink-0'" />
  </button>
</template>
