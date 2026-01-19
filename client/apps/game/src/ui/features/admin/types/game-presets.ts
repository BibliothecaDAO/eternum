export type GamePresetType = "blitz" | "tournament" | "practice" | "custom";

export interface GamePresetConfigOverrides {
  // ============================================================================
  // Basic Settings
  // ============================================================================

  // Duration
  durationHours: number;
  durationMinutes: number;

  // Fee configuration
  hasFee: boolean;
  feeAmount: string;
  feePrecision: number;

  // Registration
  registrationCountMax: number;

  // Modes
  devMode: boolean;
  singleRealmMode: boolean;

  // ============================================================================
  // Registration Timing
  // ============================================================================
  registrationDelaySeconds: number;
  registrationPeriodSeconds: number;

  // ============================================================================
  // Season Timing
  // ============================================================================
  startSettlingAfterSeconds: number;
  bridgeCloseAfterEndSeconds: number;
  pointRegistrationCloseAfterEndSeconds: number;

  // ============================================================================
  // Battle Settings
  // ============================================================================
  battleGraceTickCount: number;
  battleGraceTickCountHyp: number;
  battleDelaySeconds: number;

  // ============================================================================
  // Tick Intervals
  // ============================================================================
  defaultTickIntervalSeconds: number;
  armiesTickIntervalSeconds: number;
  deliveryTickIntervalSeconds: number;

  // ============================================================================
  // Movement & Speed
  // ============================================================================
  speedDonkey: number;
  speedArmy: number;

  // ============================================================================
  // Exploration
  // ============================================================================
  explorationReward: number;
  shardsMinesFailProbability: number;
  shardsMinesWinProbability: number;
  agentFindProbability: number;
  agentFindFailProbability: number;
  villageFindProbability: number;
  villageFindFailProbability: number;
  hyperstructureWinProbAtCenter: number;
  hyperstructureFailProbAtCenter: number;
  questFindProbability: number;
  questFindFailProbability: number;

  // ============================================================================
  // Troop Stamina
  // ============================================================================
  staminaGainPerTick: number;
  staminaInitial: number;
  staminaBonusValue: number;
  staminaKnightMax: number;
  staminaPaladinMax: number;
  staminaCrossbowmanMax: number;
  staminaAttackReq: number;
  staminaDefenseReq: number;
  staminaExploreWheatCost: number;
  staminaExploreFishCost: number;
  staminaExploreStaminaCost: number;
  staminaTravelWheatCost: number;
  staminaTravelFishCost: number;
  staminaTravelStaminaCost: number;

  // ============================================================================
  // Troop Limits
  // ============================================================================
  explorerMaxPartyCount: number;
  explorerAndGuardMaxTroopCount: number;
  guardResurrectionDelay: number;
  mercenariesTroopLowerBound: number;
  mercenariesTroopUpperBound: number;

  // ============================================================================
  // Settlement
  // ============================================================================
  settlementCenter: number;
  settlementBaseDistance: number;
  settlementSubsequentDistance: number;

  // ============================================================================
  // Population
  // ============================================================================
  basePopulation: number;

  // ============================================================================
  // Trade
  // ============================================================================
  tradeMaxCount: number;
}

export interface GamePreset {
  id: GamePresetType;
  name: string;
  description: string;
  tagline: string;
  icon: "Zap" | "Trophy" | "GraduationCap" | "Wrench";
  features: string[];
  isRecommended?: boolean;
  configOverrides: GamePresetConfigOverrides;
}

export type TxStatus = "idle" | "running" | "success" | "error";

export interface TxState {
  status: TxStatus;
  hash?: string;
  error?: string;
}

export interface DeploymentState {
  step: "select-preset" | "review-deploy";
  selectedPreset: GamePresetType | null;

  // Customizable fields for step 2
  gameName: string;
  startTime: number; // epoch seconds, 0 = use next hour
  seriesName: string;
  seriesGameNumber: string;

  // Overrides for advanced users
  customOverrides: Partial<GamePresetConfigOverrides>;
}

export interface WorldStatus {
  deployed: boolean;
  configured: boolean;
  indexerExists: boolean;
  verifying: boolean;
  autoDeploying?: {
    current: number;
    total: number;
    stopping: boolean;
  };
}

export interface FactoryUIState {
  showAdvanced: boolean;
  showDevSection: boolean;
  showCairoOutput: boolean;
  showFullConfig: boolean;
  expandedWorldConfig: string | null;
}
