import { ID, Troops } from "@bibliothecadao/types";
import { create } from "zustand";

import { ArmyStaminaSourceSnapshot } from "./types";

const STALE_PENDING_STAMINA_MS = 60_000;

interface ArmyStaminaSourceStoreState {
  pendingSources: Record<string, ArmyStaminaSourceSnapshot>;
  authoritativeSources: Record<string, ArmyStaminaSourceSnapshot>;
  setPendingStaminaSource: (snapshot: ArmyStaminaSourceSnapshot) => void;
  clearPendingStaminaSource: (entityId: ID) => void;
  setAuthoritativeTroopsSnapshot: (input: {
    entityId: ID;
    source: "snapshot" | "live";
    troops: Troops;
    capturedAtMs?: number;
  }) => void;
}

const getSnapshotKey = (entityId: ID) => String(entityId);

export const useArmyStaminaSourceStore = create<ArmyStaminaSourceStoreState>((set) => ({
  pendingSources: {},
  authoritativeSources: {},
  setPendingStaminaSource: (snapshot) =>
    set((state) => ({
      pendingSources: {
        ...state.pendingSources,
        [getSnapshotKey(snapshot.entityId)]: snapshot,
      },
    })),
  clearPendingStaminaSource: (entityId) =>
    set((state) => {
      const nextPendingSources = { ...state.pendingSources };
      delete nextPendingSources[getSnapshotKey(entityId)];
      return {
        pendingSources: nextPendingSources,
      };
    }),
  setAuthoritativeTroopsSnapshot: ({ entityId, source, troops, capturedAtMs }) =>
    set((state) => ({
      authoritativeSources: {
        ...state.authoritativeSources,
        [getSnapshotKey(entityId)]: {
          source,
          entityId,
          amount: troops.stamina?.amount ?? 0n,
          updatedTick: Number(troops.stamina?.updated_tick ?? 0n),
          troopCount: Number(troops.count ?? 0n),
          capturedAtMs: capturedAtMs ?? Date.now(),
          troops,
        },
      },
    })),
}));

export const getFreshPendingStaminaSource = (
  entityId: ID,
  nowMs: number = Date.now(),
): ArmyStaminaSourceSnapshot | undefined => {
  const snapshot = useArmyStaminaSourceStore.getState().pendingSources[getSnapshotKey(entityId)];
  if (!snapshot) {
    return undefined;
  }

  if (!snapshot.capturedAtMs || nowMs - snapshot.capturedAtMs > STALE_PENDING_STAMINA_MS) {
    return undefined;
  }

  return snapshot;
};

export const getAuthoritativeTroopsSnapshot = (entityId: ID): ArmyStaminaSourceSnapshot | undefined =>
  useArmyStaminaSourceStore.getState().authoritativeSources[getSnapshotKey(entityId)];
