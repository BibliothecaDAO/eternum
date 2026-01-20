// Game state enum
export enum GameState {
  NO_GAME = "NO_GAME",
  REGISTRATION = "REGISTRATION",
  GAME_ACTIVE = "GAME_ACTIVE",
}

// Settlement stage
export type SettleStage = "idle" | "assigning" | "settling" | "done" | "error";

// Entry token status
export type EntryTokenStatus = "idle" | "minting" | "timeout" | "error";

// Registration stage for combined obtain + register flow
export type RegistrationStage = "idle" | "obtaining-token" | "waiting-for-token" | "registering" | "done" | "error";

// Blitz step for progress indicator
export type BlitzStep = "select-game" | "obtain-token" | "register" | "settle" | "play";

// Factory game type
export interface FactoryGame {
  name: string;
  status: "checking" | "ok" | "fail";
  toriiBaseUrl: string;
  startMainAt: number | null;
  endAt: number | null;
}

// Factory game category
export type FactoryGameCategory = "ongoing" | "upcoming" | "ended" | "offline";

// Blitz config from the contract
export interface BlitzRegistrationConfig {
  registration_start_at: number;
  registration_end_at: number;
  creation_start_at: number;
  creation_end_at: number;
  fee_amount: bigint;
  fee_token: bigint;
  entry_token_address: bigint;
  registration_count?: number;
}
