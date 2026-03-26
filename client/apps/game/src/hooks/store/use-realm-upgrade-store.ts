import { create } from "zustand";

export type RealmUpgradeActionStatus = "idle" | "submitting" | "confirming" | "syncing" | "syncTimeout";

export interface RealmUpgradeAction {
  expectedLevel: number;
  status: Exclude<RealmUpgradeActionStatus, "idle">;
  startedAt: number;
}

interface RealmUpgradeStoreState {
  upgradesByRealm: Record<number, RealmUpgradeAction | undefined>;
  startUpgrade: (structureEntityId: number, expectedLevel: number) => void;
  setUpgradeStatus: (
    structureEntityId: number,
    status: Exclude<RealmUpgradeActionStatus, "idle">,
    expectedLevel?: number,
  ) => void;
  clearUpgrade: (structureEntityId: number) => void;
  getUpgrade: (structureEntityId: number | null | undefined) => RealmUpgradeAction | null;
}

const resolveRealmUpgrade = (
  upgradesByRealm: Record<number, RealmUpgradeAction | undefined>,
  structureEntityId: number | null | undefined,
) => {
  if (!Number.isFinite(structureEntityId)) {
    return null;
  }

  return upgradesByRealm[structureEntityId] ?? null;
};

export const useRealmUpgradeStore = create<RealmUpgradeStoreState>((set, get) => ({
  upgradesByRealm: {},

  startUpgrade: (structureEntityId, expectedLevel) =>
    set((state) => ({
      upgradesByRealm: {
        ...state.upgradesByRealm,
        [structureEntityId]: {
          expectedLevel,
          status: "submitting",
          startedAt: Date.now(),
        },
      },
    })),

  setUpgradeStatus: (structureEntityId, status, expectedLevel) =>
    set((state) => {
      const currentUpgrade = state.upgradesByRealm[structureEntityId];

      if (!currentUpgrade && expectedLevel === undefined) {
        return state;
      }

      return {
        upgradesByRealm: {
          ...state.upgradesByRealm,
          [structureEntityId]: {
            expectedLevel: expectedLevel ?? currentUpgrade?.expectedLevel ?? 0,
            status,
            startedAt: currentUpgrade?.startedAt ?? Date.now(),
          },
        },
      };
    }),

  clearUpgrade: (structureEntityId) =>
    set((state) => {
      if (!(structureEntityId in state.upgradesByRealm)) {
        return state;
      }

      const { [structureEntityId]: _removedUpgrade, ...remainingUpgrades } = state.upgradesByRealm;
      return { upgradesByRealm: remainingUpgrades };
    }),

  getUpgrade: (structureEntityId) => resolveRealmUpgrade(get().upgradesByRealm, structureEntityId),
}));
