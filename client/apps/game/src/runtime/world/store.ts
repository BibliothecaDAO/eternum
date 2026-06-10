import type { Chain } from "@contracts";
import type { WorldProfile, WorldProfilesMap } from "./types";

const ACTIVE_KEY = "ACTIVE_WORLD_NAME";
const CHAIN_KEY = "ACTIVE_WORLD_CHAIN";
const PROFILES_KEY = "WORLD_PROFILES";
const ACTIVE_WORLD_EVENT = "runtime:active-world-changed";
const SELECTED_CHAIN_EVENT = "runtime:selected-chain-changed";
const ZERO_WORLD_ADDRESS = "0x0";
const PADDED_ZERO_WORLD_ADDRESS = `0x${"0".repeat(64)}`;

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

const isSlotWorldChain = (chain: Chain): boolean => chain === "slot" || chain === "slottest";

const isZeroWorldAddress = (worldAddress: string | null | undefined): boolean => {
  const normalized = worldAddress?.toLowerCase();
  return normalized === ZERO_WORLD_ADDRESS || normalized === PADDED_ZERO_WORLD_ADDRESS;
};

const isUnavailableSlotWorldProfile = (profile: WorldProfile): boolean => {
  return isSlotWorldChain(profile.chain) && isZeroWorldAddress(profile.worldAddress);
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

const getSelectedChain = (): Chain | null => {
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

export const listSavedWorldProfiles = (): WorldProfile[] => Object.values(getWorldProfiles());

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
  const profile = profiles[name] ?? null;
  if (!profile) return null;
  if (isUnavailableSlotWorldProfile(profile)) return null;
  return profile;
};

/**
 * Removes slot profiles saved with worldAddress=0x0 by an earlier build.
 * Run once at boot — read paths must stay side-effect-free so a transient
 * null (e.g. from a disconnected Torii) can't silently drop the active world.
 */
export const purgeUnavailableSlotWorldProfiles = (): void => {
  const profiles = getWorldProfiles();
  let changed = false;

  for (const [name, profile] of Object.entries(profiles)) {
    if (isUnavailableSlotWorldProfile(profile)) {
      delete profiles[name];
      changed = true;
      const active = getActiveWorldName();
      if (active === name) clearActiveWorld();
    }
  }

  if (changed) saveWorldProfiles(profiles);
};

/**
 * Removes the slot profiles named in `deadNames` from the saved world map and
 * clears the active world pointer if it referenced one of them.
 *
 * Slot worlds are ephemeral: a profile saved while the deployment was alive
 * keeps a real `worldAddress` and a per-world RPC URL, but the RPC starts
 * returning `-32000 deployment {name} not found` once Cartridge tears it down.
 * If we leave that profile in place, `dojoConfig` bakes the dead RPC into
 * `ControllerConnector`, `starknet_chainId` fails, and the user is stuck on
 * "Reconnect to Continue" forever.
 *
 * The caller is responsible for proving deadness (e.g. via a direct RPC probe
 * against `probeSlotDeploymentRpcAlive`) so this helper stays pure-IO and
 * avoids any false-positive eviction on transient errors.
 *
 * Returns the subset of `deadNames` that actually existed in storage so
 * callers can log/telemeter what was wiped.
 */
export const purgeDeadSlotWorldProfiles = (deadNames: ReadonlySet<string>): string[] => {
  if (deadNames.size === 0) return [];

  const profiles = getWorldProfiles();
  const evicted: string[] = [];

  for (const name of deadNames) {
    const profile = profiles[name];
    if (!profile) continue;
    if (!isSlotWorldChain(profile.chain)) continue;
    delete profiles[name];
    evicted.push(name);
    const active = getActiveWorldName();
    if (active === name) clearActiveWorld();
  }

  if (evicted.length > 0) saveWorldProfiles(profiles);
  return evicted;
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

export const resolveRuntimeChain = (fallback: Chain): Chain => getActiveWorld()?.chain ?? resolveChain(fallback);
