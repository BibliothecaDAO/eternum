import type { Chain } from "@contracts";
import { WorldProfile, WorldProfilesMap } from "./types";

const ACTIVE_KEY = "ACTIVE_WORLD_NAME";
const CHAIN_KEY = "ACTIVE_WORLD_CHAIN";
const PROFILES_KEY = "WORLD_PROFILES";
const ACTIVE_WORLD_EVENT = "runtime:active-world-changed";
const SELECTED_CHAIN_EVENT = "runtime:selected-chain-changed";

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

export const getSelectedChain = (): Chain | null => {
  const stored = readStorageValue(CHAIN_KEY);
  return isValidChain(stored) ? stored : null;
};

const notifySelectedChainChanged = (chain: Chain | null) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Chain | null>(SELECTED_CHAIN_EVENT, { detail: chain }));
};

const notifyActiveWorldChanged = (name: string | null) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string | null>(ACTIVE_WORLD_EVENT, { detail: name }));
};

export const setSelectedChain = (chain: Chain) => {
  writeStorageValue(CHAIN_KEY, chain);
  notifySelectedChainChanged(chain);
};

const clearSelectedChain = () => {
  writeStorageValue(CHAIN_KEY, null);
  notifySelectedChainChanged(null);
};

export const resolveChain = (fallback: Chain): Chain => getSelectedChain() ?? fallback;

export const subscribeSelectedChain = (listener: (chain: Chain | null) => void): (() => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleSelectedChainChanged = (event: Event) => {
    const customEvent = event as CustomEvent<Chain | null>;
    listener(customEvent.detail ?? getSelectedChain());
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== CHAIN_KEY) {
      return;
    }

    listener(getSelectedChain());
  };

  window.addEventListener(SELECTED_CHAIN_EVENT, handleSelectedChainChanged as EventListener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(SELECTED_CHAIN_EVENT, handleSelectedChainChanged as EventListener);
    window.removeEventListener("storage", handleStorage);
  };
};

export const subscribeActiveWorldName = (listener: (name: string | null) => void): (() => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleActiveWorldChanged = (event: Event) => {
    const customEvent = event as CustomEvent<string | null>;
    listener(customEvent.detail ?? getActiveWorldName());
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== ACTIVE_KEY) {
      return;
    }

    listener(getActiveWorldName());
  };

  window.addEventListener(ACTIVE_WORLD_EVENT, handleActiveWorldChanged as EventListener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(ACTIVE_WORLD_EVENT, handleActiveWorldChanged as EventListener);
    window.removeEventListener("storage", handleStorage);
  };
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
};

export const saveWorldProfile = (profile: WorldProfile) => {
  const profiles = getWorldProfiles();
  profiles[profile.name] = profile;
  saveWorldProfiles(profiles);
};

const deleteWorldProfile = (name: string) => {
  const profiles = getWorldProfiles();
  if (profiles[name]) {
    delete profiles[name];
    saveWorldProfiles(profiles);
  }
  const active = getActiveWorldName();
  if (active === name) clearActiveWorld();
};

const getWorldProfile = (name: string): WorldProfile | null => {
  const profiles = getWorldProfiles();
  return profiles[name] ?? null;
};

export const getActiveWorldName = (): string | null => readStorageValue(ACTIVE_KEY);

export const setActiveWorldName = (name: string) => {
  writeStorageValue(ACTIVE_KEY, name);
  notifyActiveWorldChanged(name);
};

const clearActiveWorld = () => {
  writeStorageValue(ACTIVE_KEY, null);
  notifyActiveWorldChanged(null);
};

export const getActiveWorld = (): WorldProfile | null => {
  const name = getActiveWorldName();
  if (!name) return null;
  return getWorldProfile(name);
};
