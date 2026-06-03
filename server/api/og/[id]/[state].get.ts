import { createCanvas, loadImage } from "@napi-rs/canvas";
import { eq } from "drizzle-orm";
import experiments from "#shared/experiments";
import type { GradientStop, UniformValue } from "#shared/types";
import { decodeState } from "#shared/utils/url-state";
import { renderComposition } from "../../../utils/render-composition";
import { shaders } from "../../../database/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const GRADIENT_RESOLUTION = 256;

const DEFAULT_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// --- Gradient texture creation for server-side ---

function createGradientData(stops: GradientStop[]): Uint8Array {
  const canvas = createCanvas(GRADIENT_RESOLUTION, 1);
  const ctx = canvas.getContext("2d");

  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const gradient = ctx.createLinearGradient(0, 0, GRADIENT_RESOLUTION, 0);
  for (const stop of sorted) {
    gradient.addColorStop(Math.max(0, Math.min(1, stop.position)), stop.color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GRADIENT_RESOLUTION, 1);

  const imageData = ctx.getImageData(0, 0, GRADIENT_RESOLUTION, 1);
  return new Uint8Array(imageData.data);
}

// --- Headless rendering ---

async function renderShader(
  experimentId: string,
  stateParam?: string,
): Promise<Uint8Array | null> {
  const experiment = experiments[experimentId];
  if (!experiment) return null;

  // Lazy-import native modules (gl requires native bindings that may not be available locally)
  let createGL: any;
  let THREE: any;
  try {
    const { createRequire } = await import("module");
    const { join } = await import("path");
    const serverPkg = join(process.cwd(), ".output", "server", "package.json");
    const require = createRequire(serverPkg);
    createGL = require("gl");
    THREE = require("three");
  } catch (e) {
    console.error("Failed to import gl/three:", e);
    return null;
  }

  // Resolve uniform values: start with defaults, override with URL state
  const values: Record<string, UniformValue> = {};
  for (const group of experiment.groups) {
    for (const def of group.uniforms) {
      if (def.type === "gradient") {
        values[def.name] = (def.default as GradientStop[]).map((s) => ({ ...s }));
      } else {
        values[def.name] = def.default;
      }
    }
  }

  if (stateParam) {
    const decoded = decodeState(stateParam, experiment);
    if (decoded) {
      for (const [key, val] of Object.entries(decoded)) {
        values[key] = val;
      }
    }
  }

  // Create headless GL context
  const glContext = createGL(OG_WIDTH, OG_HEIGHT, { preserveDrawingBuffer: true });
  if (!glContext) return null;

  // Minimal canvas shim for Three.js
  const canvasShim = {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    style: {} as CSSStyleDeclaration,
    getContext: () => glContext,
    addEventListener: () => {},
    removeEventListener: () => {},
    clientWidth: OG_WIDTH,
    clientHeight: OG_HEIGHT,
  };

  try {
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasShim as unknown as HTMLCanvasElement,
      context: glContext as unknown as WebGLRenderingContext,
      antialias: false,
    });
    renderer.setSize(OG_WIDTH, OG_HEIGHT, false);
    renderer.setClearColor(0x0a0a0a);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();

    // Build uniforms
    const uniforms: Record<string, { value: unknown }> = {
      u_time: { value: 0.5 },
      u_resolution: { value: new THREE.Vector2(OG_WIDTH, OG_HEIGHT) },
      u_scale: { value: 1.0 },
    };

    for (const group of experiment.groups) {
      for (const def of group.uniforms) {
        const val = values[def.name] ?? def.default;
        switch (def.type) {
          case "float":
          case "int":
            uniforms[def.name] = { value: val as number };
            break;
          case "bool":
            uniforms[def.name] = { value: val as boolean };
            break;
          case "color":
            uniforms[def.name] = { value: new THREE.Color(val as string) };
            break;
          case "vec2": {
            const v = val as [number, number];
            uniforms[def.name] = { value: new THREE.Vector2(v[0], v[1]) };
            break;
          }
          case "gradient": {
            const stops = val as GradientStop[];
            const gradientData = createGradientData(stops);
            const texture = new THREE.DataTexture(
              gradientData,
              GRADIENT_RESOLUTION,
              1,
              THREE.RGBAFormat,
            );
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.needsUpdate = true;
            uniforms[def.name] = { value: texture };
            break;
          }
        }
      }
    }

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: experiment.vertexShader ?? DEFAULT_VERTEX_SHADER,
      fragmentShader: experiment.fragmentShader,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    renderer.render(scene, camera);

    const pixels = new Uint8Array(OG_WIDTH * OG_HEIGHT * 4);
    glContext.readPixels(0, 0, OG_WIDTH, OG_HEIGHT, glContext.RGBA, glContext.UNSIGNED_BYTE, pixels);

    geometry.dispose();
    material.dispose();
    try { renderer.dispose(); } catch { /* canvas shim may not support all cleanup */ }
    try { glContext.getExtension("STACKGL_destroy_context")?.destroy(); } catch { /* ignore */ }

    return pixels;
  } catch (e) {
    console.error("OG image render failed:", e);
    try { glContext.getExtension("STACKGL_destroy_context")?.destroy(); } catch { /* ignore */ }
    return null;
  }
}

async function drawOgOverlays(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>) {
  try {
    const storage = useStorage("assets:server");
    const logoSvg = await storage.getItemRaw("zeitwork-logo.svg");
    if (logoSvg) {
      const logo = await loadImage(logoSvg as Buffer);
      const logoTargetWidth = 160;
      const logoScale = logoTargetWidth / logo.width;
      ctx.drawImage(logo, 40, 36, logoTargetWidth, logo.height * logoScale);
    }
  } catch (e) {
    console.error("Failed to load logo:", e);
  }

  try {
    const storage = useStorage("assets:server");
    const titleSvg = await storage.getItemRaw("shader-lab-title.svg");
    if (titleSvg) {
      const title = await loadImage(titleSvg as Buffer);
      const titleTargetWidth = 320;
      const titleScale = titleTargetWidth / title.width;
      const titleW = titleTargetWidth;
      const titleH = title.height * titleScale;
      ctx.drawImage(title, 40, OG_HEIGHT - titleH - 40, titleW, titleH);
    }
  } catch (e) {
    console.error("Failed to load title:", e);
  }
}

async function compositeImage(pixels: Uint8Array): Promise<Buffer> {
  const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
  const ctx = canvas.getContext("2d");

  const imageData = ctx.createImageData(OG_WIDTH, OG_HEIGHT);
  for (let y = 0; y < OG_HEIGHT; y++) {
    const srcRow = (OG_HEIGHT - 1 - y) * OG_WIDTH * 4;
    const dstRow = y * OG_WIDTH * 4;
    for (let x = 0; x < OG_WIDTH * 4; x++) {
      imageData.data[dstRow + x] = pixels[srcRow + x]!;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  await drawOgOverlays(ctx);
  return canvas.toBuffer("image/png");
}

async function compositeFromPngBuffer(png: Buffer): Promise<Buffer> {
  const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
  const ctx = canvas.getContext("2d");
  const img = await loadImage(png);
  ctx.drawImage(img, 0, 0, OG_WIDTH, OG_HEIGHT);
  await drawOgOverlays(ctx);
  return canvas.toBuffer("image/png");
}

// --- Route handler ---
// URL: /api/og/:id/:state
// e.g. /api/og/gradient-dither/eyJzcGVlZCI6MC45Mn0

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id") || "gradient-dither";
  const rawState = getRouterParam(event, "state");
  const state = rawState && rawState !== "_" ? rawState : undefined;

  let png: Buffer | null = null;

  if (UUID_RE.test(id)) {
    const db = useDrizzle();
    const [row] = await db
      .select({ data: shaders.data })
      .from(shaders)
      .where(eq(shaders.id, id))
      .limit(1);
    if (row?.data) {
      const doc = row.data as Parameters<typeof renderComposition>[0];
      const rendered = await renderComposition(doc, { width: OG_WIDTH, height: OG_HEIGHT, time: 2 });
      if (rendered) png = await compositeFromPngBuffer(rendered);
    }
  }

  if (!png) {
    const pixels = await renderShader(id, state);
    if (!pixels) {
      return sendRedirect(event, "/og-image.png", 302);
    }
    png = await compositeImage(pixels);
  }

  setResponseHeader(event, "Content-Type", "image/png");
  setResponseHeader(event, "Cache-Control", "public, max-age=86400, s-maxage=86400");
  return png;
});
