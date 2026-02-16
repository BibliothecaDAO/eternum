import type { Chain } from "@contracts";
import { WorldProfile, WorldProfilesMap } from "./types";

const ACTIVE_KEY = "ACTIVE_WORLD_NAME";
const CHAIN_KEY = "ACTIVE_WORLD_CHAIN";
const PROFILES_KEY = "WORLD_PROFILES";
export const WORLD_SELECTION_CHANGED_EVENT = "eternum:world-selection-changed";

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const CHAIN_VALUES: Chain[] = ["sepolia", "mainnet", "slot", "slottest", "local"];

const isValidChain = (value: string | null): value is Chain => {
  if (!value) return false;
  return CHAIN_VALUES.includes(value as Chain);
};

const readStorageValue = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorageValue = (key: string, value: string | null) => {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore storage failures
  }
};

const emitWorldSelectionChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WORLD_SELECTION_CHANGED_EVENT));
};

export const getSelectedChain = (): Chain | null => {
  const stored = readStorageValue(CHAIN_KEY);
  return isValidChain(stored) ? stored : null;
};

export const setSelectedChain = (chain: Chain) => {
  writeStorageValue(CHAIN_KEY, chain);
  emitWorldSelectionChanged();
};

export const resolveChain = (fallback: Chain): Chain => getSelectedChain() ?? fallback;

export const listWorldNames = (): string[] => {
  const profiles = safeParse<WorldProfilesMap>(localStorage.getItem(PROFILES_KEY), {});
  return Object.keys(profiles);
};

const getWorldProfiles = (): WorldProfilesMap => {
  return safeParse<WorldProfilesMap>(localStorage.getItem(PROFILES_KEY), {});
};

const saveWorldProfiles = (profiles: WorldProfilesMap) => {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
};

export const saveWorldProfile = (profile: WorldProfile) => {
  const profiles = getWorldProfiles();
  profiles[profile.name] = profile;
  saveWorldProfiles(profiles);
};

const getWorldProfile = (name: string): WorldProfile | null => {
  const profiles = getWorldProfiles();
  return profiles[name] ?? null;
};

export const getActiveWorldName = (): string | null => localStorage.getItem(ACTIVE_KEY);

export const setActiveWorldName = (name: string) => {
  localStorage.setItem(ACTIVE_KEY, name);
  emitWorldSelectionChanged();
};

export const getActiveWorld = (): WorldProfile | null => {
  const name = getActiveWorldName();
  if (!name) return null;
  return getWorldProfile(name);
};
