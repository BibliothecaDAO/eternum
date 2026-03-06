import { Direction, HexPosition, ID } from "@bibliothecadao/types";

export const WORLDMAP_PENDING_FX_START_EVENT = "worldmapPendingFxStart";
export const WORLDMAP_PENDING_FX_STOP_EVENT = "worldmapPendingFxStop";

export type PendingWorldmapFxStartPayload =
  | {
      key: string;
      kind: "create-army";
      structureId: ID;
      direction: Direction;
      troopResourceId: number;
      timeoutMs?: number;
    }
  | {
      key: string;
      kind: "attack";
      attackerId: ID;
      defenderId?: ID;
      attackerHex: HexPosition;
      targetHex: HexPosition;
      timeoutMs?: number;
    };

export interface PendingWorldmapFxStopPayload {
  key: string;
}

export function createPendingWorldmapFxKey(prefix: "create-army" | "attack"): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export function dispatchPendingWorldmapFxStart(payload: PendingWorldmapFxStartPayload): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<PendingWorldmapFxStartPayload>(WORLDMAP_PENDING_FX_START_EVENT, { detail: payload }),
  );
}

export function dispatchPendingWorldmapFxStop(payload: PendingWorldmapFxStopPayload): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<PendingWorldmapFxStopPayload>(WORLDMAP_PENDING_FX_STOP_EVENT, { detail: payload }),
  );
}
