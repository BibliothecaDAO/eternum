import type { GamePreset, GamePresetType } from "../types/game-presets";

export const GAME_PRESETS: Record<GamePresetType, GamePreset> = {
  blitz: {
    id: "blitz",
    name: "Blitz",
    description: "Fast-paced 2-hour games with entry fees",
    tagline: "2 hours | Entry fee | High stakes",
    icon: "Zap",
    features: ["2-hour game duration", "Entry fee required", "Fast action speed", "Up to 30 players"],
    isRecommended: true,
    configOverrides: {
      durationHours: 2,
      durationMinutes: 0,
      hasFee: true,
      feeAmount: "0.000000000000001", // Default for testnet, will be overridden per chain
      feePrecision: 18,
      registrationCountMax: 30,
      devMode: false,
      singleRealmMode: true,
    },
  },
  tournament: {
    id: "tournament",
    name: "Tournament",
    description: "Customizable high-stakes competitive games",
    tagline: "Custom duration | Higher stakes | Competitive",
    icon: "Trophy",
    features: ["Customizable duration (default 6hr)", "Higher entry fees", "Tournament-style play", "Up to 64 players"],
    configOverrides: {
      durationHours: 6,
      durationMinutes: 0,
      hasFee: true,
      feeAmount: "250",
      feePrecision: 18,
      registrationCountMax: 64,
      devMode: false,
      singleRealmMode: false,
    },
  },
  practice: {
    id: "practice",
    name: "Practice",
    description: "Free games for learning and testing",
    tagline: "Free | Dev mode | No stakes",
    icon: "GraduationCap",
    features: ["1-hour duration", "No entry fee", "Dev mode enabled", "Up to 10 players"],
    configOverrides: {
      durationHours: 1,
      durationMinutes: 0,
      hasFee: false,
      feeAmount: "0",
      feePrecision: 18,
      registrationCountMax: 10,
      devMode: true,
      singleRealmMode: true,
    },
  },
};

/**
 * Get chain-specific preset overrides
 */
export const getPresetForChain = (presetId: GamePresetType, chain: string): GamePreset => {
  const preset = structuredClone(GAME_PRESETS[presetId]);

  // Chain-specific fee adjustments
  if (chain === "mainnet") {
    if (presetId === "blitz") {
      preset.configOverrides.feeAmount = "250";
    } else if (presetId === "tournament") {
      preset.configOverrides.feeAmount = "500";
    }
  } else if (chain === "sepolia" || chain === "slot") {
    // Lower fees for testnet
    if (presetId === "blitz") {
      preset.configOverrides.feeAmount = "0.000000000000001";
    } else if (presetId === "tournament") {
      preset.configOverrides.feeAmount = "0.00000000000001";
    }
  }

  return preset;
};

/**
 * Get all presets as an array (for iteration)
 */
export const getPresetsArray = (): GamePreset[] => Object.values(GAME_PRESETS);

/**
 * Get the recommended preset
 */
export const getRecommendedPreset = (): GamePreset | undefined => {
  return Object.values(GAME_PRESETS).find((p) => p.isRecommended);
};
