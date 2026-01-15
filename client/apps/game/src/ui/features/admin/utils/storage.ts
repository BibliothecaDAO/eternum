import {
  CURRENT_WORLD_NAME_KEY,
  WORLD_NAMES_STORAGE_KEY,
  CONFIGURED_WORLDS_KEY,
  INDEXER_CREATION_COOLDOWN_KEY,
  INDEXER_COOLDOWN_MS,
  WORLD_DEPLOYED_ADDRESS_MAP_KEY,
} from "../constants";

export const getStoredWorldNames = (): string[] => {
  try {
    const stored = localStorage.getItem(WORLD_NAMES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveWorldNameToStorage = (worldName: string) => {
  try {
    const existing = getStoredWorldNames();
    if (!existing.includes(worldName)) {
      const updated = [...existing, worldName];
      localStorage.setItem(WORLD_NAMES_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
};

export const persistStoredWorldNames = (names: string[]) => {
  try {
    localStorage.setItem(WORLD_NAMES_STORAGE_KEY, JSON.stringify(names));
  } catch {}
};

export const getConfiguredWorlds = (): string[] => {
  try {
    const stored = localStorage.getItem(CONFIGURED_WORLDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const markWorldAsConfigured = (worldName: string) => {
  try {
    const existing = getConfiguredWorlds();
    if (!existing.includes(worldName)) {
      localStorage.setItem(CONFIGURED_WORLDS_KEY, JSON.stringify([...existing, worldName]));
    }
  } catch {}
};

export const getCurrentWorldName = (): string | null => {
  try {
    return localStorage.getItem(CURRENT_WORLD_NAME_KEY);
  } catch {
    return null;
  }
};

export const setCurrentWorldName = (worldName: string) => {
  try {
    localStorage.setItem(CURRENT_WORLD_NAME_KEY, worldName);
  } catch {}
};

export const getIndexerCooldown = (worldName: string): number | null => {
  try {
    const stored = localStorage.getItem(`${INDEXER_CREATION_COOLDOWN_KEY}_${worldName}`);
    return stored ? parseInt(stored, 10) : null;
  } catch {
    return null;
  }
};

export const setIndexerCooldown = (worldName: string) => {
  try {
    const cooldownUntil = Date.now() + INDEXER_COOLDOWN_MS;
    localStorage.setItem(`${INDEXER_CREATION_COOLDOWN_KEY}_${worldName}`, cooldownUntil.toString());
  } catch {}
};

export const isWorldOnCooldown = (worldName: string): boolean => {
  const until = getIndexerCooldown(worldName);
  return until ? Date.now() < until : false;
};

export const getRemainingCooldown = (worldName: string): number => {
  const until = getIndexerCooldown(worldName);
  if (!until) return 0;
  return Math.ceil(Math.max(0, until - Date.now()) / 1000);
};

export const getDeployedAddressMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(WORLD_DEPLOYED_ADDRESS_MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

export const setDeployedAddressMap = (map: Record<string, string>) => {
  try {
    localStorage.setItem(WORLD_DEPLOYED_ADDRESS_MAP_KEY, JSON.stringify(map));
  } catch {}
};

export const cacheDeployedAddress = (worldName: string, address: string) => {
  const map = getDeployedAddressMap();
  if (address) {
    map[worldName] = address;
    setDeployedAddressMap(map);
  }
};
