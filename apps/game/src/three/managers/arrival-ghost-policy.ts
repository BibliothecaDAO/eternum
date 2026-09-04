import { Color } from "three";

export type ArrivalGhostClearReason =
  | "settled"
  | "failed"
  | "projection_occupied"
  | "army_removed"
  | "scene_destroyed"
  | "superseded";

export interface ArrivalGhostVisualStyle {
  color: string;
  opacity: number;
  scaleMultiplier: number;
  yOffset: number;
}

export function shouldCreatePredictiveArrivalGhost(input: {
  hasTargetHex: boolean;
  isLocalArmy: boolean;
  movementType: "travel" | "explore";
}): boolean {
  return input.isLocalArmy && input.hasTargetHex && isPredictiveArrivalGhostMovement(input.movementType);
}

function isPredictiveArrivalGhostMovement(movementType: "travel" | "explore"): boolean {
  return movementType === "travel" || movementType === "explore";
}

export function resolveArrivalGhostVisualStyle(input: { armyColor: string }): ArrivalGhostVisualStyle {
  const ghostColor = new Color(input.armyColor);
  const ghostHsl = { h: 0, s: 0, l: 0 };
  ghostColor.getHSL(ghostHsl);
  ghostColor.setHSL(ghostHsl.h, ghostHsl.s * 0.28, Math.min(0.88, ghostHsl.l * 0.62 + 0.24));
  ghostColor.lerp(new Color("#b8ffb0"), 0.62);

  return {
    color: `#${ghostColor.getHexString()}`,
    opacity: 0.52,
    scaleMultiplier: 1,
    yOffset: 0.05,
  };
}
