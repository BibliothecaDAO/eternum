import { ActionType, configManager, type OrderRefusal } from "@bibliothecadao/eternum";
import { afterEach, describe, expect, it, vi } from "vitest";

import { orderTip, orderWheat } from "./order-tip";

const step = (actionType: ActionType, staminaCost?: number) => ({ hex: { col: 0, row: 0 }, actionType, staminaCost });
type Path = ReturnType<typeof step>[];
const tile = (
  path: Path | undefined,
  more: Partial<{
    target: string | null;
    explored: boolean;
    occupied: boolean;
    refusal: OrderRefusal;
    staminaWait: number;
    clickPreviews: boolean;
    wheat: number;
  }> = {},
) =>
  orderTip({
    path,
    target: null,
    exploreStamina: 21,
    wheat: 0,
    explored: true,
    occupied: false,
    refusal: undefined,
    staminaWait: undefined,
    points: { exploreTile: 5, openRelicCrate: 250 },
    clickPreviews: false,
    ...more,
  });
const line = (...args: Parameters<typeof tile>) => tile(...args)?.line;

describe("what a right-click on a tile does, said before the click", () => {
  it("names the order, what it costs and what it pays", () => {
    expect(line([step(ActionType.Move), step(ActionType.Explore)])).toBe(
      "Right-click · Explore · 21 stamina · +5 points",
    );
    expect(line([step(ActionType.Move), step(ActionType.Move, 1), step(ActionType.Move, 1)])).toBe(
      "Right-click · Move · 2 stamina",
    );
    expect(line([step(ActionType.Move), step(ActionType.Explore)], { wheat: 50 })).toBe(
      "Right-click · Explore · 21 stamina · 50 wheat · +5 points",
    );
    expect(line([step(ActionType.Move), step(ActionType.Chest)])).toBe("Right-click · Open crate · +250 points");
    expect(line([step(ActionType.Move), step(ActionType.Attack, 30)], { target: "Rift" })).toBe(
      "Rift · Right-click · Attack · forecast",
    );
    expect(line([step(ActionType.Move), step(ActionType.Attack, 30)])).toBe("Right-click · Attack · forecast");
    expect(line([step(ActionType.Move), step(ActionType.Help)])).toBe("Right-click · Transfer troops");
  });

  it("says why the rules gave no order: the stamina and when it is ready, the food, a structure off limits", () => {
    expect(line(undefined, { refusal: { reason: "stamina", need: 21 }, staminaWait: 45 })).toBe(
      "Needs 21 stamina, ready in under a minute",
    );
    expect(line(undefined, { refusal: { reason: "stamina", need: 21 }, staminaWait: 61 })).toBe(
      "Needs 21 stamina, ready in 2 min",
    );
    expect(line(undefined, { refusal: { reason: "stamina", need: 21 } })).toBe("Needs 21 stamina");
    expect(line(undefined, { refusal: { reason: "food" } })).toBe("Not enough food for the army");
    expect(line(undefined, { refusal: { reason: "off-limits" }, occupied: true })).toBe(
      "Only unclaimed structures can be attacked",
    );
  });

  it("says a crate, a structure, an army or fog with no order is too far, and nothing of an empty revealed tile", () => {
    expect(line(undefined, { occupied: true })).toBe("Too far: move next to it");
    expect(line(undefined, { explored: false })).toBe("Unexplored · Too far: move next to it");
    expect(tile(undefined)).toBeNull();
    expect(tile([step(ActionType.Move)])).toBeNull();
  });

  it("adds that a click previews where the HUD carries the order's verb, on an explore or a move only", () => {
    expect(tile([step(ActionType.Move), step(ActionType.Explore)], { clickPreviews: true })?.gestures).toBe(
      "Click previews",
    );
    expect(tile([step(ActionType.Move), step(ActionType.Explore)])?.gestures).toBeNull();
    expect(tile([step(ActionType.Move), step(ActionType.Attack, 30)], { clickPreviews: true })?.gestures).toBeNull();
  });
});

describe("the wheat an order burns", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is an explore's, or a move's for each step, by the troops' food rule, and nothing for any other order", () => {
    // Blitz: 0.05 wheat a troop to explore, 0.01 a troop each step of a move.
    vi.spyOn(configManager, "getTravelFoodCostConfig").mockReturnValue({
      exploreWheatBurnAmount: 0.05,
      exploreFishBurnAmount: 0,
      travelWheatBurnAmount: 0.01,
      travelFishBurnAmount: 0,
    } as never);
    const troops = { category: "Knight", count: 1_000n * 1_000_000_000n } as never;
    expect(orderWheat([step(ActionType.Move), step(ActionType.Explore)], troops)).toBeCloseTo(50);
    expect(orderWheat([step(ActionType.Move), step(ActionType.Move, 1), step(ActionType.Move, 1)], troops)).toBeCloseTo(
      20,
    );
    expect(orderWheat([step(ActionType.Move), step(ActionType.Attack, 30)], troops)).toBe(0);
    expect(orderWheat(undefined, troops)).toBe(0);
  });
});
