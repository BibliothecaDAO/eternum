import type { TerrainPropLod } from "./terrain-prop-catalog";

export const TERRAIN_QUALITY_TIERS = Object.freeze(["overview", "balanced", "detail"] as const);
export type TerrainQualityTier = (typeof TERRAIN_QUALITY_TIERS)[number];

interface TerrainQualityProfile {
  dustInteractionStrength: number;
  fogMistStrength: number;
  fogMotionStrength: number;
  groundTextureDetail: boolean;
  propLod: TerrainPropLod;
  waterInteractionStrength: number;
  waterMotion: number;
  windStrength: number;
}

export const TERRAIN_QUALITY_PROFILES: Readonly<Record<TerrainQualityTier, TerrainQualityProfile>> = Object.freeze({
  overview: {
    dustInteractionStrength: 0,
    fogMistStrength: 0,
    fogMotionStrength: 0.08,
    groundTextureDetail: false,
    propLod: "far",
    waterInteractionStrength: 0,
    waterMotion: 0.2,
    windStrength: 0.12,
  },
  balanced: {
    dustInteractionStrength: 0.55,
    fogMistStrength: 0.12,
    fogMotionStrength: 0.45,
    groundTextureDetail: true,
    propLod: "far",
    waterInteractionStrength: 0.55,
    waterMotion: 0.55,
    windStrength: 0.35,
  },
  detail: {
    dustInteractionStrength: 1,
    fogMistStrength: 0.24,
    fogMotionStrength: 1,
    groundTextureDetail: true,
    propLod: "near",
    waterInteractionStrength: 1,
    waterMotion: 1,
    windStrength: 1,
  },
});
