import { ActionType, configManager, type OrderRefusal } from "@bibliothecadao/eternum";
import { afterEach, describe, expect, it, vi } from "vitest";

import { orderFood, orderTip } from "./order-tip";

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
    site: Parameters<typeof orderTip>[0]["site"];
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
    site: undefined,
    ...more,
  });
const line = (...args: Parameters<typeof tip>) => tip(...args)?.line ?? null;
const cost = (...args: Parameters<typeof tip>) => tip(...args)?.cost ?? null;

describe("what a right-click on a tile does, said before the click", () => {
  it("names the order alone: no gesture, no description, no payoff", () => {
    expect(line([step(ActionType.Move), step(ActionType.Explore)])).toBe("Explore");
    expect(line([step(ActionType.Move), step(ActionType.Move, 1), step(ActionType.Move, 1)])).toBe("Move");
    expect(line([step(ActionType.Move), step(ActionType.Chest)])).toBe("Open crate");
    expect(line([step(ActionType.Move), step(ActionType.Attack, 30)])).toBe("Attack");
    expect(line([step(ActionType.Move), step(ActionType.Help)])).toBe("Transfer troops");
    expect(line([step(ActionType.Move), step(ActionType.SpireTravel)])).toBe("Travel through the spire");
    expect(line([step(ActionType.Move), step(ActionType.UseSite, 0)])).toBe("Use");
  });

  it("says under a site's Use what it gives, which costs nothing: a Shrine's XP, the stamina a Well lands", () => {
    const use = [step(ActionType.Move), step(ActionType.UseSite, 0)];
    const at = (site: NonNullable<Parameters<typeof tip>[1]>["site"]) => cost(use, { site });
    expect(at({ kind: "Shrine", gain: 200, stamina: undefined })).toBe("+200 XP");
    expect(at({ kind: "Well", gain: 60, stamina: { current: 30, max: 120 } })).toBe("+60 stamina");
    // A Well never fills past the bar: what lands, and nothing at a full bar, which the line warns of.
    expect(at({ kind: "Well", gain: 60, stamina: { current: 100, max: 120 } })).toBe("+20 stamina, to full");
    expect(at({ kind: "Well", gain: 60, stamina: { current: 120, max: 120 } })).toBe(
      "Stamina full: the well would be wasted",
    );
    // A Shrine whose XP rules have not synced names no gain rather than a wrong one.
    expect(at({ kind: "Shrine", gain: undefined, stamina: undefined })).toBeNull();
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

  it("says a crate as its action alone, and an order that costs nothing with no cost line", () => {
    expect(tip([step(ActionType.Move), step(ActionType.Chest, 5)], { food: { wheat: 10, fish: 0 } })).toEqual({
      line: "Open crate",
      cost: null,
    });
    expect(cost([step(ActionType.Move), step(ActionType.Help)])).toBeNull();
  });

  it("says why the planner gave no order, in its own reason", () => {
    const short = { refusal: { reason: "stamina", need: 21 } as const, staminaHeld: 9 };
    expect(line(undefined, { ...short, staminaWait: 24 })).toBe("Needs 21 stamina, have 9 · in 24s");
    expect(line(undefined, { ...short, staminaWait: 130 })).toBe("Needs 21 stamina, have 9 · in 2m 10s");
    expect(line(undefined, { ...short, staminaWait: 3_600 })).toBe("Needs 21 stamina, have 9 · in 1h");
    expect(line(undefined, { refusal: { reason: "stamina", need: 21 } })).toBe("Needs 21 stamina, have —");
    expect(line(undefined, { refusal: { reason: "food" } })).toBe("Not enough food for the army");
    expect(line(undefined, { refusal: { reason: "off-limits" } })).toBe("Only unclaimed structures can be attacked");
    expect(line(undefined, { refusal: { reason: "no-transfer" } })).toBe("This game allows no transfer here");
    expect(line(undefined, { refusal: { reason: "occupied" } })).toBe("No army can enter this tile");
    expect(line(undefined, { refusal: { reason: "too-far" } })).toBe("Too far: move closer");
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
