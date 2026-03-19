import type { FactoryGameMode } from "./types";

const FACTORY_PENDING_LAUNCHES_STORAGE_KEY = "factory-v2-pending-launches";

export interface FactoryPendingLaunch {
  environmentId: string;
  gameName: string;
  mode: FactoryGameMode;
  createdAt: string;
}

export function readFactoryPendingLaunches(): FactoryPendingLaunch[] {
  const storage = resolvePendingLaunchStorage();

  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(FACTORY_PENDING_LAUNCHES_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isFactoryPendingLaunch).sort(comparePendingLaunchesByRecency);
  } catch {
    return [];
  }
}

export function writeFactoryPendingLaunches(pendingLaunches: FactoryPendingLaunch[]) {
  const storage = resolvePendingLaunchStorage();

  if (!storage) {
    return;
  }

  try {
    if (pendingLaunches.length === 0) {
      storage.removeItem(FACTORY_PENDING_LAUNCHES_STORAGE_KEY);
      return;
    }

    storage.setItem(FACTORY_PENDING_LAUNCHES_STORAGE_KEY, JSON.stringify(pendingLaunches));
  } catch {
    // Ignore storage failures and keep the in-memory fallback working.
  }
}

function resolvePendingLaunchStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isFactoryPendingLaunch(value: unknown): value is FactoryPendingLaunch {
  if (!value || typeof value !== "object") {
    return false;
  }

  const pendingLaunch = value as Partial<FactoryPendingLaunch>;

  return (
    typeof pendingLaunch.environmentId === "string" &&
    pendingLaunch.environmentId.length > 0 &&
    typeof pendingLaunch.gameName === "string" &&
    pendingLaunch.gameName.length > 0 &&
    (pendingLaunch.mode === "eternum" || pendingLaunch.mode === "blitz") &&
    typeof pendingLaunch.createdAt === "string" &&
    pendingLaunch.createdAt.length > 0
  );
}

function comparePendingLaunchesByRecency(left: FactoryPendingLaunch, right: FactoryPendingLaunch) {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}
