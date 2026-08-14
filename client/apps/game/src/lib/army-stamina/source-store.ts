import { ID } from "@bibliothecadao/types";
import { create } from "zustand";

import { PendingArmyStaminaSourceSnapshot } from "./types";

const STALE_PENDING_STAMINA_MS = 60_000;

interface ArmyStaminaSourceStoreState {
  pendingSources: Record<string, PendingArmyStaminaSourceSnapshot>;
  setPendingStaminaSource: (snapshot: PendingArmyStaminaSourceSnapshot) => void;
  clearPendingStaminaSource: (entityId: ID) => void;
}

const getSnapshotKey = (entityId: ID) => String(entityId);

export const useArmyStaminaSourceStore = create<ArmyStaminaSourceStoreState>((set) => ({
  pendingSources: {},
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
}));

export const getFreshPendingStaminaSource = (
  entityId: ID,
  nowMs: number = Date.now(),
): PendingArmyStaminaSourceSnapshot | undefined => {
  const snapshot = useArmyStaminaSourceStore.getState().pendingSources[getSnapshotKey(entityId)];
  if (!snapshot) {
    return undefined;
  }

  if (!snapshot.capturedAtMs || nowMs - snapshot.capturedAtMs > STALE_PENDING_STAMINA_MS) {
    return undefined;
  }

  return snapshot;
};
