# Plan: Shader Lab SDK & Monorepo Migration

## Goal

Transform the Shader Lab project into a monorepo with a lightweight, framework-agnostic renderer SDK that uses raw WebGL (no Three.js). Users create compositions in the editor, export a JSON config, install the SDK package, and render the shader on their website.

---

## 1. Monorepo Structure

Migrate from a single Nuxt app to a pnpm workspace monorepo:

```
shader-lab/
├── pnpm-workspace.yaml
├── package.json              ← root workspace config
├── turbo.json                ← turborepo config (optional, for build orchestration)
│
├── packages/
│   ├── core/                 ← @shader-lab/core — raw WebGL renderer + modulation engine
│   │   ├── src/
│   │   │   ├── index.ts              ← public API: createComposition()
│   │   │   ├── renderer.ts           ← raw WebGL multi-pass renderer
│   │   │   ├── program.ts            ← shader compile/link/uniform dispatch
│   │   │   ├── framebuffer.ts        ← FBO management for multi-pass
│   │   │   ├── texture.ts            ← gradient texture upload, texture utils
│   │   │   ├── quad.ts               ← fullscreen quad VAO
│   │   │   ├── modulation.ts         ← LFO engine (wave points, Schlick bias)
│   │   │   ├── compiler.ts           ← layer stack → render pass compiler
│   │   │   ├── types.ts              ← all public types (re-exported)
│   │   │   └── shaders/              ← all .frag/.vert files as string constants
│   │   │       ├── index.ts          ← exports all shaders as a Record<LayerType, string>
│   │   │       ├── gradient.frag
│   │   │       ├── distortion.frag
│   │   │       ├── dither.frag
│   │   │       ├── grain.frag
│   │   │       ├── noise.frag
│   │   │       ├── solid.frag
│   │   │       ├── vignette.frag
│   │   │       ├── output.frag
│   │   │       └── fullscreen.vert
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts           ← build config (tsup for ESM/CJS output)
│   │
│   ├── vue/                  ← @shader-lab/vue — Vue 3 component wrapper
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── ShaderComposition.vue
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── react/                ← @shader-lab/react — React component wrapper (future)
│       ├── src/
│       │   ├── index.ts
│       │   └── ShaderComposition.tsx
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   └── web/                  ← the Nuxt editor app (current app/, server/, shared/)
│       ├── app/
│       ├── server/
│       ├── shared/           ← app-specific shared code (experiments, url-state)
│       ├── nuxt.config.ts
│       ├── package.json
│       └── tsconfig.json
│
└── shared/                   ← workspace-wide shared code
    ├── types/
    │   ├── index.ts          ← UniformDef, GradientStop, etc.
    │   └── editor.ts         ← LayerInstance, LFOSource, WavePoint, etc.
    ├── editor/
    │   ├── layer-templates.ts
    │   ├── lfo-colors.ts
    │   └── lfo-presets.ts
    └── shaders/
        ├── layers/           ← all layer .frag/.vert files (source of truth)
        │   └── ...
        └── gradient-dither.frag  ← legacy single-pass shader for experiments
```

### Key decisions:

- **pnpm workspaces** for dependency management (already using pnpm/bun)
- **tsup** for building the SDK packages (simple, fast, outputs ESM + CJS)
- **Shared code** lives at the root `shared/` directory and is referenced by both the core package and the Nuxt app
- The Nuxt app moves to `apps/web/` but keeps working exactly as before
- The core package bundles the shaders as string constants (using tsup's raw loader or a build script)

---

## 2. Core Package: `@shader-lab/core`

### 2.1 Raw WebGL Renderer

Replace Three.js's `WebGLRenderer`, `ShaderMaterial`, `WebGLRenderTarget`, etc. with a thin WebGL wrapper. The total code is ~300-400 lines.

#### `program.ts` — Shader program management

```ts
export class ShaderProgram {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniformLocations: Map<string, WebGLUniformLocation>;

  constructor(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string);
  use(): void;
  setFloat(name: string, value: number): void;
  setInt(name: string, value: number): void;
  setVec2(name: string, x: number, y: number): void;
  setVec3(name: string, x: number, y: number, z: number): void;
  setTexture(name: string, texture: WebGLTexture, unit: number): void;
  dispose(): void;
}
```

Internally:
- `gl.createShader()`, `gl.compileShader()`, `gl.createProgram()`, `gl.linkProgram()`
- Uniform location cache via `gl.getUniformLocation()`
- Type-specific `gl.uniform1f()`, `gl.uniform2f()`, `gl.uniform1i()`, etc.
- Error logging for compile/link failures

#### `framebuffer.ts` — Render target management

```ts
export class RenderTarget {
  gl: WebGL2RenderingContext;
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;

  constructor(gl: WebGL2RenderingContext, width: number, height: number, options?: { wrap?: number });
  bind(): void;                    // gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
  unbind(): void;                  // gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  resize(width: number, height: number): void;
  dispose(): void;
}
```

Internally:
- `gl.createFramebuffer()`, `gl.createTexture()`, `gl.framebufferTexture2D()`
- Texture params: `gl.MIRRORED_REPEAT` wrapping, `gl.LINEAR` filter
- Resize recreates the texture and re-attaches to the framebuffer
- `gl.checkFramebufferStatus()` for validation

#### `quad.ts` — Fullscreen quad

```ts
export class FullscreenQuad {
  gl: WebGL2RenderingContext;
  vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, program: ShaderProgram);
  draw(): void;    // gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 6)
  dispose(): void;
}
```

A 2-triangle quad covering [-1, 1] in clip space with UVs [0, 1]. The vertex shader becomes:

```glsl
#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUv;
void main() {
  vUv = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
```

No more `projectionMatrix` or `modelViewMatrix` — they were no-ops anyway.

#### `texture.ts` — Texture utilities

```ts
export function createTextureFromCanvas(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): WebGLTexture;
export function updateTextureFromCanvas(gl: WebGL2RenderingContext, texture: WebGLTexture, canvas: HTMLCanvasElement): void;
export function renderGradientToCanvas(stops: GradientStop[], width?: number): HTMLCanvasElement;
export function hexToRGB(hex: string): [number, number, number];
```

#### `renderer.ts` — Multi-pass composition renderer

```ts
export class CompositionRenderer {
  private gl: WebGL2RenderingContext;
  private programs: Map<string, ShaderProgram>;
  private renderTargets: Map<string, RenderTarget>;
  private quad: FullscreenQuad;
  private gradientCache: Map<string, WebGLTexture>;

  constructor(canvas: HTMLCanvasElement, options?: { pixelRatio?: number });

  /** Update the render passes (called when composition changes) */
  setPasses(passes: RenderPass[]): void;

  /** Render one frame at the given time */
  renderFrame(time: number, passes: RenderPass[]): void;

  /** Handle resize */
  resize(width: number, height: number): void;

  /** Get the canvas element */
  getCanvas(): HTMLCanvasElement;

  /** Clean up all GPU resources */
  dispose(): void;
}
```

#### `modulation.ts` — LFO engine (framework-agnostic)

Extract from the current `use-modulation-engine.ts` but without Vue reactivity:

```ts
export class ModulationEngine {
  private lfos: LFOSource[];
  private assignments: ModulationAssignment[];
  private lfoValues: Record<string, number>;
  private lfoPhases: Record<string, number>;
  private startTime: number;

  constructor();

  setLFOs(lfos: LFOSource[]): void;
  setAssignments(assignments: ModulationAssignment[]): void;

  /** Compute all LFO values for the current time */
  tick(time: number): void;

  /** Get the modulated value for a parameter */
  getModulatedValue(layerId: string, paramName: string, baseValue: number): number;

  /** Get the current LFO output value (0-1) */
  getLFOValue(lfoId: string): number;

  /** Get the current LFO phase position (0-1) */
  getLFOPhase(lfoId: string): number;
}

// Pure functions (also exported for use in the editor's wave preview)
export function schlickBias(t: number, b: number): number;
export function evaluateWavePoints(points: WavePoint[], t: number): number;
export function getOnCurveY(p1y: number, p2y: number, curve: number): number;
export function curveFromOnCurveY(p1y: number, p2y: number, onCurveY: number): number;
```

#### `compiler.ts` — Layer compiler (framework-agnostic)

Extract from `use-layer-compiler.ts`:

```ts
export function compilePasses(
  layers: LayerInstance[],
  getModulatedValue?: (layerId: string, paramName: string, baseValue: number) => number,
): RenderPass[];
```

#### `index.ts` — Public API

```ts
import { CompositionRenderer } from './renderer';
import { ModulationEngine } from './modulation';
import { compilePasses } from './compiler';

export type CompositionConfig = {
  version: number;
  layers: LayerInstance[];
  lfos: LFOSource[];
  assignments: ModulationAssignment[];
};

export function createComposition(canvas: HTMLCanvasElement, config: CompositionConfig, options?: {
  pixelRatio?: number;
  autoplay?: boolean;
}) {
  const renderer = new CompositionRenderer(canvas, options);
  const engine = new ModulationEngine();

  engine.setLFOs(config.lfos);
  engine.setAssignments(config.assignments);

  let animationId: number | null = null;
  let running = false;

  function tick() {
    const time = performance.now() / 1000;
    engine.tick(time);
    const passes = compilePasses(config.layers, engine.getModulatedValue.bind(engine));
    renderer.renderFrame(time, passes);
    if (running) animationId = requestAnimationFrame(tick);
  }

  return {
    play() { running = true; tick(); },
    pause() { running = false; if (animationId) cancelAnimationFrame(animationId); },
    destroy() { this.pause(); renderer.dispose(); },
    updateConfig(newConfig: CompositionConfig) { /* hot-update layers/lfos/assignments */ },
    getCanvas() { return renderer.getCanvas(); },
  };
}

// Re-export types
export type { CompositionConfig, LayerInstance, LFOSource, ModulationAssignment, WavePoint, ... };
```

### 2.2 Shader Bundling

The shaders need to be bundled as string constants in the core package. Two approaches:

**Option A: Build-time embedding**
Use tsup's `loader` config to import `.frag`/`.vert` files as strings:
```ts
// tsup.config.ts
export default defineConfig({
  loader: { '.frag': 'text', '.vert': 'text' },
});
```

**Option B: Code generation**
A build script reads all `.frag`/`.vert` files and generates a `shaders/index.ts` that exports them as string constants:
```ts
export const GRADIENT_FRAG = `#ifdef GL_ES\nprecision mediump float;\n...`;
```

Option A is simpler. Option B avoids loader issues. Either works.

### 2.3 Vertex Shader Migration

The current `fullscreen.vert` uses Three.js built-in attributes:
```glsl
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

The raw WebGL version:
```glsl
#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUv;
void main() {
  vUv = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
```

All fragment shaders also need updating:
- `varying vec2 vUv;` → `in vec2 vUv;` (GLSL 300 es)
- `gl_FragColor = ...` → `out vec4 fragColor; ... fragColor = ...`
- `texture2D(...)` → `texture(...)`

OR we can keep GLSL 100 (WebGL1 compatible) and just remove the Three.js vertex shader built-ins. The fragment shaders can stay as-is since `gl_FragCoord` and `texture2D` work in GLSL 100.

**Recommendation**: Keep GLSL 100 for maximum compatibility. Only change the vertex shader.

Updated vertex shader (GLSL 100):
```glsl
attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUv;
void main() {
  vUv = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
```

Fragment shaders: no changes needed (they already use `gl_FragCoord`, `gl_FragColor`, `texture2D`).

### 2.4 Package Build & Publishing

```json
// packages/core/package.json
{
  "name": "@shader-lab/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "peerDependencies": {},
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.9.0"
  }
}
```

Zero runtime dependencies. No Three.js. No framework. Just raw WebGL.

---

## 3. Vue Wrapper: `@shader-lab/vue`

```vue
<!-- packages/vue/src/ShaderComposition.vue -->
<script setup lang="ts">
import { createComposition, type CompositionConfig } from '@shader-lab/core';

type Props = {
  config: CompositionConfig;
  pixelRatio?: number;
  autoplay?: boolean;
};

const { config, pixelRatio, autoplay = true } = defineProps<Props>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let composition: ReturnType<typeof createComposition> | null = null;

onMounted(() => {
  if (!canvasRef.value) return;
  composition = createComposition(canvasRef.value, config, { pixelRatio, autoplay });
});

onUnmounted(() => {
  composition?.destroy();
});

watch(() => config, (newConfig) => {
  composition?.updateConfig(newConfig);
}, { deep: true });

defineExpose({
  play: () => composition?.play(),
  pause: () => composition?.pause(),
});
</script>

<template>
  <canvas ref="canvasRef" class="size-full" />
</template>
```

```json
// packages/vue/package.json
{
  "name": "@shader-lab/vue",
  "version": "0.1.0",
  "peerDependencies": {
    "@shader-lab/core": "workspace:*",
    "vue": "^3.0.0"
  }
}
```

---

## 4. React Wrapper: `@shader-lab/react` (future)

```tsx
import { useRef, useEffect } from 'react';
import { createComposition, type CompositionConfig } from '@shader-lab/core';

export function ShaderComposition({ config, pixelRatio, autoplay = true, className }: {
  config: CompositionConfig;
  pixelRatio?: number;
  autoplay?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositionRef = useRef<ReturnType<typeof createComposition> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    compositionRef.current = createComposition(canvasRef.current, config, { pixelRatio, autoplay });
    return () => compositionRef.current?.destroy();
  }, []);

  useEffect(() => {
    compositionRef.current?.updateConfig(config);
  }, [config]);

  return <canvas ref={canvasRef} className={className} />;
}
```

---

## 5. Editor App Migration

### 5.1 Move to `apps/web/`

The Nuxt app moves to `apps/web/` with minimal changes. The main difference: import paths for shared code change from `#shared/...` to `@shader-lab/core` for the renderer-related code.

### 5.2 Replace Three.js with `@shader-lab/core`

**`use-multi-pass-renderer.ts`** → thin Vue composable that wraps `CompositionRenderer`:

```ts
import { CompositionRenderer } from '@shader-lab/core';

export function useMultiPassRenderer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  passes: ComputedRef<RenderPass[]>,
) {
  let renderer: CompositionRenderer | null = null;

  onMounted(() => {
    if (!canvasRef.value) return;
    renderer = new CompositionRenderer(canvasRef.value);
    animate();
  });

  function animate() {
    const time = performance.now() / 1000;
    renderer?.renderFrame(time, passes.value);
    requestAnimationFrame(animate);
  }

  onUnmounted(() => renderer?.dispose());
}
```

**`use-shader.ts`** (single-pass experiment renderer) → similar wrapper around a simpler `SinglePassRenderer` class from the core, or keep Three.js temporarily for the legacy experiment page and migrate later.

**`use-modulation-engine.ts`** → thin Vue composable wrapping `ModulationEngine`:

```ts
import { ModulationEngine } from '@shader-lab/core';

export function useModulationEngine(lfos: Ref<LFOSource[]>, assignments: Ref<ModulationAssignment[]>) {
  const engine = new ModulationEngine();
  const lfoValues = ref<Record<string, number>>({});
  const lfoPhases = ref<Record<string, number>>({});

  // Sync Vue refs to engine
  watch(lfos, (v) => engine.setLFOs(v), { deep: true, immediate: true });
  watch(assignments, (v) => engine.setAssignments(v), { deep: true, immediate: true });

  // rAF loop updates Vue refs
  function tick() {
    engine.tick(performance.now() / 1000);
    lfoValues.value = { ...engine.getAllValues() };
    lfoPhases.value = { ...engine.getAllPhases() };
    requestAnimationFrame(tick);
  }

  onMounted(() => tick());

  return { lfoValues, lfoPhases, getModulatedValue: engine.getModulatedValue.bind(engine) };
}
```

### 5.3 Remove Three.js

After migration, remove `three` and `@types/three` from dependencies. The server-side OG renderer also migrates to use `@shader-lab/core` with a headless GL context.

---

## 6. Export Flow from the Editor

### 6.1 Save/Load (localStorage + JSON files)

**Auto-save**: Debounced write to localStorage on every change. Restore on page load.

**Export JSON**: "Save" button downloads a `composition.json` file.

**Import JSON**: "Load" button opens a file picker and restores the composition.

### 6.2 SDK Export Dialog

When the user clicks "Export" → "Get SDK Code":

A dialog showing:

```
┌─────────────────────────────────────────────────────┐
│ Use this shader on your website                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│ 1. Install the package:                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │ npm install @shader-lab/core                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ 2. Copy your composition config:                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ { "version": 1, "layers": [...], ... }          │ │
│ └─────────────────────────────────────────────────┘ │
│ [Copy JSON] [Download .json]                         │
│                                                      │
│ 3. Add to your project:                              │
│ [Vanilla JS] [Vue] [React]                           │
│ ┌─────────────────────────────────────────────────┐ │
│ │ import { createComposition } from '@shader-...' │ │
│ │ import config from './shader.json'              │ │
│ │                                                 │ │
│ │ const comp = createComposition(canvas, config)  │ │
│ │ comp.play()                                     │ │
│ └─────────────────────────────────────────────────┘ │
│ [Copy Code]                                          │
└─────────────────────────────────────────────────────┘
```

---

## 7. Implementation Order

### Phase 1: Monorepo setup
- Create `pnpm-workspace.yaml`
- Move Nuxt app to `apps/web/`
- Update all import paths
- Verify the app still works

### Phase 2: Core package — raw WebGL renderer
- Create `packages/core/`
- Implement `program.ts`, `framebuffer.ts`, `quad.ts`, `texture.ts`
- Implement `renderer.ts` (CompositionRenderer)
- Update vertex shader (remove Three.js built-ins)
- Bundle shaders as strings
- Build with tsup, verify output

### Phase 3: Core package — modulation + compiler
- Extract `modulation.ts` from `use-modulation-engine.ts` (remove Vue deps)
- Extract `compiler.ts` from `use-layer-compiler.ts`
- Export public API from `index.ts`
- Write `createComposition()` orchestrator

### Phase 4: Editor migration
- Replace `use-multi-pass-renderer.ts` Three.js usage with `@shader-lab/core`
- Replace `use-modulation-engine.ts` with thin Vue wrapper around core engine
- Replace `use-layer-compiler.ts` with thin wrapper around core compiler
- Remove Three.js from `apps/web/package.json`
- Verify editor still works identically

### Phase 5: Vue wrapper
- Create `packages/vue/`
- Implement `ShaderComposition.vue`
- Test with a standalone Vite + Vue project

### Phase 6: Export flow
- Add localStorage auto-save to the editor
- Add JSON export/import
- Add SDK code export dialog with install instructions and code snippets

### Phase 7: Legacy experiment migration
- Migrate `use-shader.ts` (single-pass) to raw WebGL
- Migrate server OG renderer to `@shader-lab/core`
- Remove Three.js and `gl` dependencies entirely

### Phase 8: Publishing
- Set up npm publishing pipeline
- Write minimal README with usage examples
- Publish `@shader-lab/core` and `@shader-lab/vue`

---

## 8. Bundle Size Estimate

| Package | Estimated gzipped size |
|---|---|
| `@shader-lab/core` (renderer + modulation + shaders) | ~7KB |
| `@shader-lab/vue` (component wrapper) | ~1KB |
| `@shader-lab/react` (component wrapper) | ~1KB |
| **vs Three.js (current)** | **~150KB** |

A 20x reduction in client bundle size, with zero runtime dependencies.

---

## 9. Open Questions

1. **WebGL1 vs WebGL2**: WebGL2 is supported on 97%+ of browsers. WebGL1 has wider support but lacks some features (VAOs need extensions, no `texture()` in GLSL 100). Recommendation: target WebGL2 with a check, no WebGL1 fallback.

2. **Server-side rendering**: The OG image generator currently uses the `gl` npm package for headless WebGL. The core renderer should work with any WebGL context, including headless ones. Need to verify `gl` provides a WebGL2 context.

3. **Shader validation**: The editor currently compiles shaders at runtime via Three.js. The core renderer needs its own compile error handling and reporting.

4. **Hot module replacement**: During development, shader changes should hot-reload. The current `vite-plugin-glsl` handles this for the Nuxt app. The core package build (tsup) would need its own approach, or the dev workflow imports shaders from the workspace `shared/` directory directly.

5. **Tree-shaking**: If a user only uses certain layer types, can unused shaders be tree-shaken? Probably not since they're bundled as strings keyed by name. But at ~3KB total for all shaders, this is negligible.

6. **Interactivity API**: When mouse/device interactivity is added, the core package needs to accept input events and map them to modulation values. The API should be designed now even if not implemented:
   ```ts
   composition.setInput('mouseX', normalizedX);
   composition.setInput('mouseY', normalizedY);
   ```
