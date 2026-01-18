export type GamePresetType = "blitz" | "tournament" | "practice" | "custom";

export interface GamePresetConfigOverrides {
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
