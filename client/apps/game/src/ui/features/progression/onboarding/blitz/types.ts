import type { FactoryWorldCategories, FactoryWorldGame } from "@bibliothecadao/react";

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

// Blitz step for progress indicator
export type BlitzStep = "select-game" | "obtain-token" | "register" | "settle" | "play";

export type { FactoryWorldCategories, FactoryWorldGame as FactoryGame };

// Factory game category
export type FactoryGameCategory = keyof FactoryWorldCategories;

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
