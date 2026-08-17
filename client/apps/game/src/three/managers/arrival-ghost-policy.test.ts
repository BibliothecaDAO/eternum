import { describe, expect, it } from "vitest";
import { resolveArrivalGhostVisualStyle, shouldCreatePredictiveArrivalGhost } from "./arrival-ghost-policy";

describe("arrival-ghost-policy", () => {
  it("creates predictive ghosts for local travel and explore moves with a target hex", () => {
    expect(
      shouldCreatePredictiveArrivalGhost({
        hasTargetHex: true,
        isLocalArmy: true,
        movementType: "travel",
      }),
    ).toBe(true);

    expect(
      shouldCreatePredictiveArrivalGhost({
        hasTargetHex: true,
        isLocalArmy: true,
        movementType: "explore",
      }),
    ).toBe(true);

    expect(
      shouldCreatePredictiveArrivalGhost({
        hasTargetHex: true,
        isLocalArmy: false,
        movementType: "explore",
      }),
    ).toBe(false);

    expect(
      shouldCreatePredictiveArrivalGhost({
        hasTargetHex: false,
        isLocalArmy: true,
        movementType: "travel",
      }),
    ).toBe(false);
  });

  it("returns the configured ghost visuals", () => {
    const style = resolveArrivalGhostVisualStyle({ armyColor: "#3366ff" });

    expect(style.opacity).toBe(0.52);
    expect(style.scaleMultiplier).toBe(1);
    expect(style.yOffset).toBe(0.05);
    expect(style.color).toMatch(/^#/);
  });
});
