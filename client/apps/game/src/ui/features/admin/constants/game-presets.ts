import type { GamePreset, GamePresetConfigOverrides, GamePresetType } from "../types/game-presets";

/**
 * Default values for all advanced configuration fields.
 * These are sensible defaults based on standard game settings.
 */
const DEFAULT_ADVANCED_CONFIG: Omit<
  GamePresetConfigOverrides,
  | "durationHours"
  | "durationMinutes"
  | "hasFee"
  | "feeAmount"
  | "feePrecision"
  | "registrationCountMax"
  | "devMode"
  | "singleRealmMode"
> = {
  // Registration Timing
  registrationDelaySeconds: 0,
  registrationPeriodSeconds: 3600, // 1 hour

  // Season Timing
  startSettlingAfterSeconds: 0,
  bridgeCloseAfterEndSeconds: 7200, // 2 hours after end
  pointRegistrationCloseAfterEndSeconds: 3600, // 1 hour after end

  // Battle Settings
  battleGraceTickCount: 12,
  battleGraceTickCountHyp: 24,
  battleDelaySeconds: 60,

  // Tick Intervals
  defaultTickIntervalSeconds: 1,
  armiesTickIntervalSeconds: 3600, // 1 hour
  deliveryTickIntervalSeconds: 1,

  // Movement & Speed
  speedDonkey: 10,
  speedArmy: 10,

  // Exploration
  explorationReward: 100,
  shardsMinesFailProbability: 0,
  shardsMinesWinProbability: 100,
  agentFindProbability: 50,
  agentFindFailProbability: 50,
  villageFindProbability: 50,
  villageFindFailProbability: 50,
  hyperstructureWinProbAtCenter: 100,
  hyperstructureFailProbAtCenter: 0,
  questFindProbability: 50,
  questFindFailProbability: 50,

  // Troop Stamina
  staminaGainPerTick: 20,
  staminaInitial: 100,
  staminaBonusValue: 10,
  staminaKnightMax: 100,
  staminaPaladinMax: 100,
  staminaCrossbowmanMax: 100,
  staminaAttackReq: 20,
  staminaDefenseReq: 10,
  staminaExploreWheatCost: 10,
  staminaExploreFishCost: 10,
  staminaExploreStaminaCost: 20,
  staminaTravelWheatCost: 5,
  staminaTravelFishCost: 5,
  staminaTravelStaminaCost: 10,

  // Troop Limits
  explorerMaxPartyCount: 10,
  explorerAndGuardMaxTroopCount: 10000,
  guardResurrectionDelay: 3600,
  mercenariesTroopLowerBound: 100,
  mercenariesTroopUpperBound: 1000,

  // Settlement
  settlementCenter: 2147483646,
  settlementBaseDistance: 10,
  settlementSubsequentDistance: 5,

  // Population
  basePopulation: 5,

  // Trade
  tradeMaxCount: 100,
};

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
      ...DEFAULT_ADVANCED_CONFIG,
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
      ...DEFAULT_ADVANCED_CONFIG,
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
      ...DEFAULT_ADVANCED_CONFIG,
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
  custom: {
    id: "custom",
    name: "Custom",
    description: "Full control over all game parameters",
    tagline: "Your rules | Your way",
    icon: "Wrench",
    features: ["Configure duration", "Set entry fees", "Choose player limits", "Toggle all modes"],
    configOverrides: {
      ...DEFAULT_ADVANCED_CONFIG,
      durationHours: 2,
      durationMinutes: 0,
      hasFee: false,
      feeAmount: "0",
      feePrecision: 18,
      registrationCountMax: 30,
      devMode: false,
      singleRealmMode: false,
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
