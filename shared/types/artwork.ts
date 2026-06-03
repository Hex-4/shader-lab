import type { LayerInstance, LFOSource, ModulationAssignment } from "./editor";

export type ArtworkCanvas = {
  width: number;
  height: number;
};

export type ArtworkShaderLayer = {
  id: string;
  type: "shader";
  shaderId: string;
  enabled: boolean;
};

export type ArtworkTextLayer = {
  id: string;
  type: "text";
  enabled: boolean;
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  x: number;
  y: number;
  align: "left" | "center" | "right";
  opacity: number;
};

export type ArtworkImageLayer = {
  id: string;
  type: "image";
  enabled: boolean;
  src: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
};

export type ArtworkLayer = ArtworkShaderLayer | ArtworkTextLayer | ArtworkImageLayer;

export type ArtworkDocument = {
  version: 1;
  canvas: ArtworkCanvas;
  layers: ArtworkLayer[];
};

export type ShaderDocument = {
  version: 1;
  layers: LayerInstance[];
  lfos: LFOSource[];
  assignments: ModulationAssignment[];
};
