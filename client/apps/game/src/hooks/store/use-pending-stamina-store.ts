import { ID } from "@bibliothecadao/types";
import { create } from "zustand";

const STALE_PENDING_STAMINA_MS = 60_000;

type PendingStaminaActionKind = "travel" | "explore" | "attack" | "raid";

interface PendingStaminaOverlay {
  entityId: ID;
  amount: bigint;
  updatedTick: number;
  createdAt: number;
  actionKind: PendingStaminaActionKind;
}

interface PendingStaminaState {
  overlays: Record<string, PendingStaminaOverlay>;
  setPendingStamina: (overlay: PendingStaminaOverlay) => void;
  clearPendingStamina: (entityId: ID) => void;
}

const getOverlayKey = (entityId: ID) => String(entityId);

export const usePendingStaminaStore = create<PendingStaminaState>((set) => ({
  overlays: {},
  setPendingStamina: (overlay) =>
    set((state) => ({
      overlays: {
        ...state.overlays,
        [getOverlayKey(overlay.entityId)]: overlay,
      },
    })),
  clearPendingStamina: (entityId) =>
    set((state) => {
      const nextOverlays = { ...state.overlays };
      delete nextOverlays[getOverlayKey(entityId)];
      return {
        overlays: nextOverlays,
      };
    }),
}));

export const getFreshPendingStaminaOverlay = (
  entityId: ID,
  nowMs: number = Date.now(),
): PendingStaminaOverlay | undefined => {
  const overlay = usePendingStaminaStore.getState().overlays[getOverlayKey(entityId)];
  if (!overlay) {
    return undefined;
  }

  if (nowMs - overlay.createdAt > STALE_PENDING_STAMINA_MS) {
    return undefined;
  }

  return overlay;
};
