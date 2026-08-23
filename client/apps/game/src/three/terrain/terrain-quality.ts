import type { TerrainPropLod } from "./terrain-prop-catalog";

export const TERRAIN_QUALITY_TIERS = Object.freeze(["overview", "balanced", "detail"] as const);
export type TerrainQualityTier = (typeof TERRAIN_QUALITY_TIERS)[number];
export type TerrainCameraBand = "close" | "far" | "medium";

interface TerrainQualityProfile {
  fogMistStrength: number;
  fogMotionStrength: number;
  groundTextureDetail: boolean;
  propLod: TerrainPropLod;
  waterMotion: number;
  windStrength: number;
}

export const TERRAIN_QUALITY_PROFILES: Readonly<Record<TerrainQualityTier, TerrainQualityProfile>> = Object.freeze({
  overview: {
    fogMistStrength: 0,
    fogMotionStrength: 0.08,
    groundTextureDetail: false,
    propLod: "far",
    waterMotion: 0.2,
    windStrength: 0.12,
  },
  balanced: {
    fogMistStrength: 0.12,
    fogMotionStrength: 0.45,
    groundTextureDetail: true,
    propLod: "far",
    waterMotion: 0.55,
    windStrength: 0.35,
  },
  detail: {
    fogMistStrength: 0.24,
    fogMotionStrength: 1,
    groundTextureDetail: true,
    propLod: "near",
    waterMotion: 1,
    windStrength: 1,
  },
});

export function resolveTerrainQualityTier(cameraBand: TerrainCameraBand): TerrainQualityTier {
  if (cameraBand === "close") return "detail";
  if (cameraBand === "far") return "overview";
  return "balanced";
}
