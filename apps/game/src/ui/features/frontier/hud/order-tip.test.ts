import { ActionType, configManager, type OrderRefusal } from "@bibliothecadao/eternum";
import { afterEach, describe, expect, it, vi } from "vitest";

import { staminaShortfall } from "@/ui/design-system/kit/reasons";
import { orderFood, orderTip, refusedOrderLine } from "./order-tip";

const step = (actionType: ActionType, staminaCost?: number) => ({ hex: { col: 0, row: 0 }, actionType, staminaCost });
type Path = ReturnType<typeof step>[];
const tip = (
  path: Path | undefined,
  more: Partial<{
    explored: boolean;
    refusal: OrderRefusal;
    staminaWait: number;
    staminaHeld: number;
    food: { wheat: number; fish: number };
    byRealm: boolean;
  }> = {},
) =>
  orderTip({
    path,
    exploreStamina: 21,
    food: { wheat: 0, fish: 0 },
    explored: true,
    refusal: undefined,
    staminaWait: undefined,
    staminaHeld: undefined,
    byRealm: false,
    ...more,
  });
const line = (...args: Parameters<typeof tip>) => tip(...args)?.line ?? null;
const cost = (...args: Parameters<typeof tip>) => tip(...args)?.cost ?? null;

describe("what a right-click on a tile does, said before the click", () => {
  it("names the order alone: no gesture, no description, no payoff", () => {
    expect(line([step(ActionType.Move), step(ActionType.Explore)])).toBe("Explore");
    expect(line([step(ActionType.Move), step(ActionType.Move, 1), step(ActionType.Move, 1)])).toBe("Move");
    expect(line([step(ActionType.Move), step(ActionType.Attack, 30)])).toBe("Attack");
    expect(line([step(ActionType.Move), step(ActionType.Help)])).toBe("Transfer troops");
    expect(line([step(ActionType.Move), step(ActionType.SpireTravel)])).toBe("Enter the Spire");
  });

  it("names the realm's Help on its army beside it a reinforcement, priced on its sheet", () => {
    const help = [step(ActionType.Move), step(ActionType.Help)];
    expect(tip(help, { byRealm: true })).toEqual({ line: "Reinforce", cost: null });
    expect(line([step(ActionType.Move), step(ActionType.CreateArmy)], { byRealm: true })).toBeNull();
  });

  it("puts what the order costs on one compact line under it, rounded as every charge reads", () => {
    const explore = [step(ActionType.Move), step(ActionType.Explore)];
    expect(cost(explore, { food: { wheat: 100, fish: 0 } })).toBe("21 stamina · 100 wheat");
    expect(cost(explore, { food: { wheat: 28.15, fish: 0 } })).toBe("21 stamina · 28 wheat");
    // QA's small-army hovers (qa-fresh-chain-frontier-1 #7): no decimal in a charge.
    expect(cost(explore, { food: { wheat: 1.2, fish: 0 } })).toBe("21 stamina · 1 wheat");
    expect(cost(explore, { food: { wheat: 0.05, fish: 0 } })).toBe("21 stamina · <1 wheat");
    expect(cost(explore, { food: { wheat: 30, fish: 30 } })).toBe("21 stamina · 30 wheat · 30 fish");
    expect(cost([step(ActionType.Move), step(ActionType.Move, 1), step(ActionType.Move, 1)])).toBe("2 stamina");
    expect(cost([step(ActionType.Move), step(ActionType.Move, 1)], { food: { wheat: 0, fish: 0.03 } })).toBe(
      "1 stamina · <1 fish",
    );
    expect(cost([step(ActionType.Move), step(ActionType.Attack, 30)])).toBe("30 stamina");
  });

  it("says an order that costs nothing with no cost line", () => {
    expect(cost([step(ActionType.Move), step(ActionType.Help)])).toBeNull();
  });

  it("says why the planner gave no order, in its own reason", () => {
    const short = { refusal: { reason: "stamina", need: 21 } as const, staminaHeld: 9 };
    expect(line(undefined, { ...short, staminaWait: 130 })).toBe(staminaShortfall(9, 21, 130));
    expect(line(undefined, { refusal: { reason: "stamina", need: 21 } })).toBe(staminaShortfall(undefined, 21));
    const reasons = ["food", "off-limits", "no-attack", "no-transfer", "occupied", "too-far"] as const;
    const lines = reasons.map((reason) => line(undefined, { refusal: { reason } }));
    expect(lines).toEqual(reasons.map((reason) => refusedOrderLine(reason).line));
    expect(new Set(lines).size).toBe(reasons.length);
  });

  it("claims no distance the planner did not: fog it said nothing of is unexplored, a revealed tile is silent", () => {
    expect(line(undefined, { explored: false })).toBe("Unexplored");
    expect(tip(undefined)).toBeNull();
    expect(tip([step(ActionType.Move)])).toBeNull();
    expect(cost(undefined, { refusal: { reason: "food" } })).toBeNull();
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
