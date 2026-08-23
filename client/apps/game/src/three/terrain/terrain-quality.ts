import type { TerrainPropLod } from "./terrain-prop-catalog";

export const TERRAIN_QUALITY_TIERS = Object.freeze(["overview", "balanced", "detail"] as const);
export type TerrainQualityTier = (typeof TERRAIN_QUALITY_TIERS)[number];
export type TerrainCameraBand = "close" | "far" | "medium";

interface TerrainQualityProfile {
  groundTextureDetail: boolean;
  propLod: TerrainPropLod;
  waterMotion: number;
  windStrength: number;
}

export const TERRAIN_QUALITY_PROFILES: Readonly<Record<TerrainQualityTier, TerrainQualityProfile>> = Object.freeze({
  overview: { groundTextureDetail: false, propLod: "far", waterMotion: 0.2, windStrength: 0.12 },
  balanced: { groundTextureDetail: true, propLod: "far", waterMotion: 0.55, windStrength: 0.35 },
  detail: { groundTextureDetail: true, propLod: "near", waterMotion: 1, windStrength: 1 },
});

export function resolveTerrainQualityTier(cameraBand: TerrainCameraBand): TerrainQualityTier {
  if (cameraBand === "close") return "detail";
  if (cameraBand === "far") return "overview";
  return "balanced";
}
