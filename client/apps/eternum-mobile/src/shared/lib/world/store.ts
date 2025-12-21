import type { WorldProfile, WorldProfilesMap } from "./types";

const ACTIVE_KEY = "ACTIVE_WORLD_NAME";
const PROFILES_KEY = "WORLD_PROFILES";

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const listWorldNames = (): string[] => {
  const profiles = safeParse<WorldProfilesMap>(localStorage.getItem(PROFILES_KEY), {});
  return Object.keys(profiles);
};

export const getWorldProfiles = (): WorldProfilesMap =>
  safeParse<WorldProfilesMap>(localStorage.getItem(PROFILES_KEY), {});

export const saveWorldProfiles = (profiles: WorldProfilesMap) => {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
};

export const saveWorldProfile = (profile: WorldProfile) => {
  const profiles = getWorldProfiles();
  profiles[profile.name] = profile;
  saveWorldProfiles(profiles);
};

export const deleteWorldProfile = (name: string) => {
  const profiles = getWorldProfiles();
  if (profiles[name]) {
    delete profiles[name];
    saveWorldProfiles(profiles);
  }
  const active = getActiveWorldName();
  if (active === name) clearActiveWorld();
};

export const getWorldProfile = (name: string): WorldProfile | null => {
  const profiles = getWorldProfiles();
  return profiles[name] ?? null;
};

export const getActiveWorldName = (): string | null => localStorage.getItem(ACTIVE_KEY);

export const setActiveWorldName = (name: string) => localStorage.setItem(ACTIVE_KEY, name);

export const clearActiveWorld = () => localStorage.removeItem(ACTIVE_KEY);

export const getActiveWorld = (): WorldProfile | null => {
  const name = getActiveWorldName();
  if (!name) return null;
  return getWorldProfile(name);
};
