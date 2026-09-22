import type { GameRef } from "@bibliothecadao/eternum/game-client";
import type { GameProfile } from "./types";

const ACTIVE_KEY = "ACTIVE_GAME";
const PROFILES_KEY = "GAME_PROFILES";

type GameProfiles = Record<string, GameProfile>;

/** One spelling of a game's name for keys and caches: its shard's chain id and its id there. */
export const gameKey = (game: GameRef): string => `${game.chainId}:${game.gameId}`;

const readStorageValue = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorageValue = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A profile that is not persisted is rebuilt from the shard directory on the next entry.
  }
};

const readGameProfiles = (): GameProfiles => {
  try {
    return JSON.parse(readStorageValue(PROFILES_KEY) ?? "{}") as GameProfiles;
  } catch {
    return {};
  }
};

export const saveGameProfile = (profile: GameProfile) => {
  writeStorageValue(PROFILES_KEY, JSON.stringify({ ...readGameProfiles(), [gameKey(profile)]: profile }));
};

export const setActiveGame = (game: GameRef) => writeStorageValue(ACTIVE_KEY, gameKey(game));

export const getActiveGame = (): GameProfile | null => {
  const key = readStorageValue(ACTIVE_KEY);
  return key ? (readGameProfiles()[key] ?? null) : null;
};
