import type { FeatureHexData } from "./types";

/** Canvas-safe hex color fallbacks for oklch CSS vars. */
export const COLORS = {
  bgVoid: "#0f0f1e",
  borderEtched: "#5c5c4a",
  accentEmber: "#d4874d",
  accentBrass: "#c8a855",
  accentArcane: "#7a6aaa",
  dimText: "#3a3a30",
  featureGame: "#c8a855",
  featureLore: "#7a6aaa",
  featureAgent: "#7a6aaa",
  featureToken: "#c8a855",
  featureCommunity: "#7a6aaa",
  enemyRed: "#e05555",
} as const;

/** Map feature type to its display color. */
export function featureColor(type: FeatureHexData["type"]): string {
  switch (type) {
    case "game":
      return COLORS.featureGame;
    case "lore":
      return COLORS.featureLore;
    case "agent":
      return COLORS.featureAgent;
    case "token":
      return COLORS.featureToken;
    case "community":
      return COLORS.featureCommunity;
  }
}
