<script setup lang="ts">
import type { ArtworkShaderLayer } from "#shared/types/artwork";

const props = defineProps<{
  layer: ArtworkShaderLayer;
  shaderName?: string;
}>();

const emit = defineEmits<{
  editShader: [];
  swapShader: [];
  duplicateShader: [];
}>();
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="props.shaderName" class="text-copy-sm text-secondary">
      {{ props.shaderName }}
    </p>
    <p class="text-copy-sm text-tertiary">
      Background shader for this artwork. Use swap to link a different shader from your library without copying it.
    </p>
    <UiButton
      variant="action"
      :disabled="props.layer.shaderId === '__pending__'"
      @click="emit('swapShader')"
    >
      Swap shader…
    </UiButton>
    <UiButton
      variant="ghost"
      :disabled="props.layer.shaderId === '__pending__'"
      @click="emit('editShader')"
    >
      Edit shader
    </UiButton>
    <UiButton
      variant="ghost"
      :disabled="props.layer.shaderId === '__pending__'"
      @click="emit('duplicateShader')"
    >
      Duplicate shader
    </UiButton>
  </div>
</template>
