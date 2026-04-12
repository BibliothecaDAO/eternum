import { Color } from "three";

export type ArrivalGhostClearReason =
  | "arrived"
  | "tx_failed"
  | "stale_timeout"
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
  isTravelAction: boolean;
}): boolean {
  return input.isLocalArmy && input.isTravelAction && input.hasTargetHex;
}

export function shouldHideSourceArmyOnTileRemoval(input: {
  hasPendingMovement: boolean;
  reason: "tile" | "zero";
}): boolean {
  return input.reason !== "tile" || !input.hasPendingMovement;
}

export function shouldResolveArrivalGhost(input: {
  hasGhost: boolean;
  hasPendingMovement: boolean;
  isArmyRenderableInCurrentChunk: boolean;
}): boolean {
  return input.hasGhost && !input.hasPendingMovement && input.isArmyRenderableInCurrentChunk;
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
