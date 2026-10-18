import { ActionType, configManager, type OrderRefusal } from "@bibliothecadao/eternum";
import { afterEach, describe, expect, it, vi } from "vitest";

import { orderFood, orderTip } from "./order-tip";

const step = (actionType: ActionType, staminaCost?: number) => ({ hex: { col: 0, row: 0 }, actionType, staminaCost });
type Path = ReturnType<typeof step>[];
const tile = (
  path: Path | undefined,
  more: Partial<{
    target: string | null;
    explored: boolean;
    refusal: OrderRefusal;
    staminaWait: number;
    clickPreviews: boolean;
    food: { wheat: number; fish: number };
  }> = {},
) =>
  orderTip({
    path,
    target: null,
    exploreStamina: 21,
    food: { wheat: 0, fish: 0 },
    explored: true,
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
    expect(line([step(ActionType.Move), step(ActionType.Explore)], { food: { wheat: 50, fish: 0 } })).toBe(
      "Right-click · Explore · 21 stamina · 50 wheat · +5 points",
    );
    expect(line([step(ActionType.Move), step(ActionType.Chest)])).toBe("Right-click · Open crate · +250 points");
    expect(line([step(ActionType.Move), step(ActionType.Attack, 30)], { target: "Rift" })).toBe(
      "Rift · Right-click · Attack · forecast",
    );
    expect(line([step(ActionType.Move), step(ActionType.Attack, 30)])).toBe("Right-click · Attack · forecast");
    expect(line([step(ActionType.Move), step(ActionType.Help)])).toBe("Right-click · Transfer troops");
  });

  it("lists every food an order charges, to the unit the chain charges it, and none it does not", () => {
    const explore = [step(ActionType.Move), step(ActionType.Explore)];
    expect(line(explore, { food: { wheat: 0.05, fish: 0 } })).toBe(
      "Right-click · Explore · 21 stamina · 0.05 wheat · +5 points",
    );
    expect(line(explore, { food: { wheat: 30, fish: 30 } })).toBe(
      "Right-click · Explore · 21 stamina · 30 wheat · 30 fish · +5 points",
    );
    expect(line([step(ActionType.Move), step(ActionType.Move, 1)], { food: { wheat: 0, fish: 0.03 } })).toBe(
      "Right-click · Move · 1 stamina · 0.03 fish",
    );
  });

  it("says why the planner gave no order, in its own reason", () => {
    expect(line(undefined, { refusal: { reason: "stamina", need: 21 }, staminaWait: 24 })).toBe(
      "Needs 21 stamina, ready in 24s",
    );
    expect(line(undefined, { refusal: { reason: "stamina", need: 21 }, staminaWait: 130 })).toBe(
      "Needs 21 stamina, ready in 2m 10s",
    );
    expect(line(undefined, { refusal: { reason: "stamina", need: 21 }, staminaWait: 3_600 })).toBe(
      "Needs 21 stamina, ready in 1h",
    );
    expect(line(undefined, { refusal: { reason: "stamina", need: 21 } })).toBe("Needs 21 stamina");
    expect(line(undefined, { refusal: { reason: "food" } })).toBe("Not enough food for the army");
    expect(line(undefined, { refusal: { reason: "off-limits" } })).toBe("Only unclaimed structures can be attacked");
    expect(line(undefined, { refusal: { reason: "no-transfer" } })).toBe("This game allows no transfer here");
    expect(line(undefined, { refusal: { reason: "occupied" } })).toBe("No army can enter this tile");
    expect(line(undefined, { refusal: { reason: "too-far" } })).toBe("Too far: move next to it");
  });

  it("claims no distance the planner did not: fog it said nothing of is unexplored, a revealed tile is silent", () => {
    expect(line(undefined, { explored: false })).toBe("Unexplored");
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

describe("the food an order burns", () => {
  afterEach(() => vi.restoreAllMocks());
  const explore = [step(ActionType.Move), step(ActionType.Explore)];
  const twoSteps = [step(ActionType.Move), step(ActionType.Move, 1), step(ActionType.Move, 1)];
  const rates = (rates: Record<string, number>) =>
    vi.spyOn(configManager, "getTravelFoodCostConfig").mockReturnValue(rates as never);
  const troops = (count: number) => ({ category: "Knight", count: BigInt(count) * 1_000_000_000n }) as never;

  it("is an explore's, or a move's for each step, by the troops' food rule, and nothing for any other order", () => {
    // Blitz: 0.05 wheat a troop to explore, 0.01 a troop each step of a move.
    rates({
      exploreWheatBurnAmount: 0.05,
      exploreFishBurnAmount: 0,
      travelWheatBurnAmount: 0.01,
      travelFishBurnAmount: 0,
    });
    expect(orderFood(explore, troops(1_000))).toEqual({ wheat: 50, fish: 0 });
    expect(orderFood(twoSteps, troops(1_000))).toEqual({ wheat: 20, fish: 0 });
    expect(orderFood([step(ActionType.Move), step(ActionType.Attack, 30)], troops(1_000))).toEqual({
      wheat: 0,
      fish: 0,
    });
    expect(orderFood(undefined, troops(1_000))).toEqual({ wheat: 0, fish: 0 });
  });

  it("keeps a one-troop charge that is a fraction of a unit, and the fish where the game charges it", () => {
    rates({
      exploreWheatBurnAmount: 0.05,
      exploreFishBurnAmount: 0,
      travelWheatBurnAmount: 0.01,
      travelFishBurnAmount: 0,
    });
    expect(orderFood(explore, troops(1)).wheat).toBeCloseTo(0.05);
    // Eternum: 0.03 wheat and 0.03 fish a troop, to explore and each step of a move.
    rates({
      exploreWheatBurnAmount: 0.03,
      exploreFishBurnAmount: 0.03,
      travelWheatBurnAmount: 0.03,
      travelFishBurnAmount: 0.03,
    });
    expect(orderFood(explore, troops(1_000))).toEqual({ wheat: 30, fish: 30 });
    expect(orderFood(twoSteps, troops(1_000))).toEqual({ wheat: 60, fish: 60 });
  });
});
