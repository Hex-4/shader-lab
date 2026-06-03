import type { ArtworkDocument } from "../types/artwork";
import { getShaderPreset } from "./shader-presets";

export type ArtworkPreset = {
  id: string;
  name: string;
  description: string;
  /** Shader preset id to embed as background (created on first save). */
  shaderPresetId: string;
  canvas: { width: number; height: number };
};

export const ARTWORK_PRESETS: ArtworkPreset[] = [
  {
    id: "square",
    name: "Square post",
    description: "1080×1080 with mesh bloom background.",
    shaderPresetId: "mesh-bloom",
    canvas: { width: 1080, height: 1080 },
  },
  {
    id: "story",
    name: "Story",
    description: "1080×1920 vertical with mesh bloom.",
    shaderPresetId: "mesh-bloom",
    canvas: { width: 1080, height: 1920 },
  },
  {
    id: "og",
    name: "Open Graph",
    description: "1200×630 link preview with dither gradient.",
    shaderPresetId: "dither-gradient",
    canvas: { width: 1200, height: 630 },
  },
  {
    id: "twitter",
    name: "Twitter post",
    description: "1200×675 in-feed image with mesh bloom.",
    shaderPresetId: "mesh-bloom",
    canvas: { width: 1200, height: 675 },
  },
  {
    id: "blank",
    name: "Blank",
    description: "Empty artwork — add text and link a shader.",
    shaderPresetId: "blank",
    canvas: { width: 1080, height: 1080 },
  },
];

export const DEFAULT_ARTWORK_PRESET_ID = "square";

export function getArtworkPreset(id: string): ArtworkPreset | undefined {
  return ARTWORK_PRESETS.find((p) => p.id === id);
}

/** Document for a new artwork (shader layer uses placeholder id until save). */
export function buildArtworkPresetDocument(presetId: string): {
  document: ArtworkDocument;
  preset: ArtworkPreset;
  shaderPresetName: string;
} {
  const preset = getArtworkPreset(presetId) ?? getArtworkPreset(DEFAULT_ARTWORK_PRESET_ID)!;
  const shaderPreset = getShaderPreset(preset.shaderPresetId);
  const includeShader = preset.shaderPresetId !== "blank";

  const layers: ArtworkDocument["layers"] = [];
  if (includeShader) {
    layers.push({ id: "shader-1", type: "shader", shaderId: "__pending__", enabled: true });
  }
  if (presetId !== "blank") {
    layers.unshift({
      id: "text-1",
      type: "text",
      enabled: true,
      content: "Your headline",
      runs: [{ text: "Your headline" }],
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: 400,
      lineHeight: 1.25,
      letterSpacing: 0,
      color: "#ffffff",
      x: 0.5,
      y: 0.55,
      align: "center",
      opacity: 1,
    });
  }

  const document: ArtworkDocument = {
    version: 1,
    canvas: { ...preset.canvas },
    layers,
  };

  return {
    document,
    preset,
    shaderPresetName: shaderPreset?.name ?? "Shader",
  };
}
