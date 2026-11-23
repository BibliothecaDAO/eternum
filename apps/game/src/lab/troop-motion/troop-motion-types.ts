export type TroopMotionKind = "knight";
export type TroopMotionAction = "idle" | "march" | "attack" | "hit" | "death" | "reel";
export type TroopMotionCamera = "desktop" | "phone";

export interface TroopMotionState {
  troop: TroopMotionKind;
  action: TroopMotionAction;
  camera: TroopMotionCamera;
  compareShipped: boolean;
  shippedBaseUrl: string | null;
}

export interface TroopMotionLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  visible: boolean;
}

export const TROOP_MOTION_ACTIONS: ReadonlyArray<{ id: TroopMotionAction; label: string }> = [
  { id: "idle", label: "Idle" },
  { id: "march", label: "March" },
  { id: "attack", label: "Attack" },
  { id: "hit", label: "Hit" },
  { id: "death", label: "Death" },
  { id: "reel", label: "All 5 Reel" },
];

export const REEL_SEQUENCE: ReadonlyArray<{
  action: Exclude<TroopMotionAction, "reel">;
  label: string;
  durationSeconds: number;
}> = [
  { action: "idle", label: "Idle", durationSeconds: 2.0 },
  { action: "march", label: "March", durationSeconds: 2.6 },
  { action: "attack", label: "Attack", durationSeconds: 2.8 },
  { action: "hit", label: "Hit", durationSeconds: 2.0 },
  { action: "death", label: "Death", durationSeconds: 2.4 },
];

export function parseTroopMotionState(search: string): TroopMotionState {
  const params = new URLSearchParams(search);
  const rawAction = params.get("action");
  const action: TroopMotionAction =
    rawAction === "idle" ||
    rawAction === "march" ||
    rawAction === "attack" ||
    rawAction === "hit" ||
    rawAction === "death" ||
    rawAction === "reel"
      ? rawAction
      : "march";
  const camera: TroopMotionCamera = params.get("camera") === "phone" ? "phone" : "desktop";
  const shippedBaseUrl = params.get("shippedUrl") || null;
  const compareShipped = params.get("compare") === "1" && Boolean(shippedBaseUrl);
  return {
    troop: "knight",
    action,
    camera,
    compareShipped,
    shippedBaseUrl,
  };
}
