import { describe, expect, it } from "vitest";
import {
  resolveArrivalGhostVisualStyle,
  shouldCreatePredictiveArrivalGhost,
  shouldHideSourceArmyOnTileRemoval,
} from "./arrival-ghost-policy";

describe("arrival-ghost-policy", () => {
  it("creates predictive ghosts only for local travel moves with a target hex", () => {
    expect(
      shouldCreatePredictiveArrivalGhost({
        hasTargetHex: true,
        isLocalArmy: true,
        isTravelAction: true,
      }),
    ).toBe(true);

    expect(
      shouldCreatePredictiveArrivalGhost({
        hasTargetHex: true,
        isLocalArmy: false,
        isTravelAction: true,
      }),
    ).toBe(false);
  });

  it("keeps the source army visible for pending tile removals", () => {
    expect(
      shouldHideSourceArmyOnTileRemoval({
        hasPendingMovement: true,
        reason: "tile",
      }),
    ).toBe(false);

    expect(
      shouldHideSourceArmyOnTileRemoval({
        hasPendingMovement: false,
        reason: "tile",
      }),
    ).toBe(true);
  });

  it("returns the configured ghost visuals", () => {
    const style = resolveArrivalGhostVisualStyle({ armyColor: "#3366ff" });

    expect(style.opacity).toBe(0.52);
    expect(style.scaleMultiplier).toBe(1);
    expect(style.yOffset).toBe(0.05);
    expect(style.color).toMatch(/^#/);
  });
});
