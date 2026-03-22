import type { FactoryGameMode, FactoryRunKind } from "./types";

const FACTORY_PENDING_LAUNCHES_STORAGE_KEY = "factory-v2-pending-launches";

export interface FactoryPendingLaunch {
  environmentId: string;
  name: string;
  mode: FactoryGameMode;
  kind: FactoryRunKind;
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

    return parsedValue.filter(isFactoryPendingLaunch).map(normalizePendingLaunch).sort(comparePendingLaunchesByRecency);
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

  const pendingLaunch = value as Partial<FactoryPendingLaunch> & { gameName?: string };
  const normalizedName = pendingLaunch.name ?? pendingLaunch.gameName;

  return (
    typeof pendingLaunch.environmentId === "string" &&
    pendingLaunch.environmentId.length > 0 &&
    typeof normalizedName === "string" &&
    normalizedName.length > 0 &&
    (pendingLaunch.mode === "eternum" || pendingLaunch.mode === "blitz") &&
    (pendingLaunch.kind === "game" ||
      pendingLaunch.kind === "series" ||
      pendingLaunch.kind === "rotation" ||
      pendingLaunch.kind === undefined) &&
    typeof pendingLaunch.createdAt === "string" &&
    pendingLaunch.createdAt.length > 0
  );
}

function normalizePendingLaunch(pendingLaunch: Partial<FactoryPendingLaunch> & { gameName?: string }) {
  return {
    environmentId: pendingLaunch.environmentId ?? "",
    name: pendingLaunch.name ?? pendingLaunch.gameName ?? "",
    mode: pendingLaunch.mode ?? "blitz",
    kind: pendingLaunch.kind ?? "game",
    createdAt: pendingLaunch.createdAt ?? "",
  } satisfies FactoryPendingLaunch;
}

function comparePendingLaunchesByRecency(left: FactoryPendingLaunch, right: FactoryPendingLaunch) {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}
