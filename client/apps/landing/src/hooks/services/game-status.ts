import { gameClientFetch } from "./apiClient";
import { QUERIES } from "./queries";

type GamePhaseState = "NO_GAME" | "REGISTRATION" | "GAME_ACTIVE";

export interface GameStatus {
  currentPhase: GamePhaseState;
  registrationStartAt?: number;
  registrationEndAt?: number;
  gameStartAt?: number;
  gameEndAt?: number;
  registrationCount?: number;
}

export const DEFAULT_GAME_STATUS: GameStatus = {
  currentPhase: "NO_GAME",
};

export async function fetchGameStatus(): Promise<GameStatus> {
  try {
    const response = await gameClientFetch(QUERIES.GAME_STATUS);
    const payload = response;
    return normalizeGameStatus(payload);
  } catch (error) {
    console.warn("Failed to fetch game status", error);
    return DEFAULT_GAME_STATUS;
  }
}

function normalizeGameStatus(payload: any): GameStatus {
  if (!payload || !Array.isArray(payload) || payload.length === 0) {
    return DEFAULT_GAME_STATUS;
  }

  const data = payload[0]; // Extract the first object from the array

  // Determine current phase based on timestamps
  const now = Date.now() / 1000; // Current time in seconds
  const registrationStartAt = parseTimestamp(data.registration_start_at);
  const registrationEndAt = parseTimestamp(data.registration_end_at);
  const gameEndAt = parseTimestamp(data.creation_end_at);

  let currentPhase: GamePhaseState = "NO_GAME";

  if (registrationStartAt && now >= registrationStartAt) {
    if (registrationEndAt && now < registrationEndAt) {
      currentPhase = "REGISTRATION";
    } else if (registrationEndAt && now >= registrationEndAt) {
      if (gameEndAt && now < gameEndAt) {
        currentPhase = "GAME_ACTIVE";
      } else {
        currentPhase = "NO_GAME";
      }
    }
  }

  return {
    currentPhase,
    registrationStartAt: parseTimestamp(data.registration_start_at),
    registrationEndAt: parseTimestamp(data.registration_end_at),
    gameStartAt: parseTimestamp(data.creation_start_at),
    gameEndAt: parseTimestamp(data.creation_end_at),
    registrationCount: undefined, // Not available in this payload structure
  };
}

function parseTimestamp(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed / 1000;
    }
  }
  return undefined;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function isValidPhase(phase: string): phase is GamePhaseState {
  return phase === "NO_GAME" || phase === "REGISTRATION" || phase === "GAME_ACTIVE";
}
