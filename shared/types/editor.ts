export type LayerCategory = "generator" | "distortion" | "effect";

export type LayerType =
  | "gradient"
  | "solid"
  | "noise"
  | "distortion"
  | "dither"
  | "grain"
  | "vignette";

export type LayerUniformDef = {
  name: string;
  type: "float" | "int" | "color" | "vec2" | "gradient" | "bool" | "select";
  label: string;
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string | number }[];
};

export type LayerTemplate = {
  type: LayerType;
  label: string;
  category: LayerCategory;
  description: string;
  uniforms: LayerUniformDef[];
  animationUniforms?: LayerUniformDef[];
};

export type LayerInstance = {
  id: string;
  type: LayerType;
  enabled: boolean;
  values: Record<string, unknown>;
  animationEnabled: boolean;
  animationValues: Record<string, unknown>;
};

export type RenderPass = {
  layerId: string;
  layerType: LayerType;
  uniforms: Record<string, unknown>;
  inputLayerId: string | null;
  isOutput: boolean;
};
