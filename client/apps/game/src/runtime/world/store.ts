import type { Chain } from "@contracts";
import { WorldProfile, WorldProfilesMap } from "./types";

const ACTIVE_KEY = "ACTIVE_WORLD_NAME";
const CHAIN_KEY = "ACTIVE_WORLD_CHAIN";
const PROFILES_KEY = "WORLD_PROFILES";
const WORLD_SELECTION_CHANGE_EVENT = "eternum:world-selection-change";

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

const notifyWorldSelectionChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WORLD_SELECTION_CHANGE_EVENT));
};

export const getSelectedChain = (): Chain | null => {
  const stored = readStorageValue(CHAIN_KEY);
  return isValidChain(stored) ? stored : null;
};

export const setSelectedChain = (chain: Chain) => {
  writeStorageValue(CHAIN_KEY, chain);
  notifyWorldSelectionChange();
};

export const resolveChain = (fallback: Chain): Chain => getSelectedChain() ?? fallback;
export const resolveActiveWorldChain = (fallback: Chain): Chain =>
  getActiveWorld()?.chain ?? getSelectedChain() ?? fallback;
export const subscribeToWorldSelectionChange = (callback: () => void): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(WORLD_SELECTION_CHANGE_EVENT, callback);
  return () => window.removeEventListener(WORLD_SELECTION_CHANGE_EVENT, callback);
};

export const listWorldNames = (): string[] => {
  const profiles = safeParse<WorldProfilesMap>(localStorage.getItem(PROFILES_KEY), {});
  return Object.keys(profiles);
};

const getWorldProfiles = (): WorldProfilesMap => {
  return safeParse<WorldProfilesMap>(localStorage.getItem(PROFILES_KEY), {});
};

const saveWorldProfiles = (profiles: WorldProfilesMap) => {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  notifyWorldSelectionChange();
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
  notifyWorldSelectionChange();
};

export const getActiveWorld = (): WorldProfile | null => {
  const name = getActiveWorldName();
  if (!name) return null;
  return getWorldProfile(name);
};
