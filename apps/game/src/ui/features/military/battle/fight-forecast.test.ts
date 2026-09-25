import type { FightForecast } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";
import { describeFight, wholeTroops } from "./fight-forecast";

const troops = (whole: number) => ({ count: BigInt(whole) * 1_000_000_000n }) as never;

type FoughtForecast = Exclude<FightForecast, { outcome: "refused" }>;

const fight = (overrides: Partial<FoughtForecast>): FightForecast => ({
  outcome: "wins",
  exchanges: 2,
  attackerLoss: 420n * 1_000_000_000n,
  defenderLoss: 1_100n * 1_000_000_000n,
  staminaSpent: 60n,
  attacker: troops(1_078),
  defender: troops(0),
  ...overrides,
});

describe("describeFight", () => {
  it("names a win by its exchanges, its losses and its stamina", () => {
    expect(describeFight(fight({}))).toBe("Wins in 2 exchanges · loses 420 · 60 stamina");
    expect(describeFight(fight({ exchanges: 1, staminaSpent: 30n }))).toBe(
      "Wins in 1 exchange · loses 420 · 30 stamina",
    );
  });

  it("names a loss and a fight the attacker cannot finish", () => {
    expect(describeFight(fight({ outcome: "loses", exchanges: 1, staminaSpent: 30n }))).toBe(
      "Falls in 1 exchange · 30 stamina",
    );
    expect(describeFight(fight({ outcome: "stalls", exchanges: 5, defender: troops(300) }))).toBe(
      "Out of stamina after 5 exchanges · 300 still defend · loses 420",
    );
  });

  it("has nothing to say when the first attack cannot be made", () => {
    expect(describeFight({ outcome: "refused", refusal: "insufficient-stamina" })).toBeNull();
  });

  it("counts whole troops as the contract does", () => {
    expect(wholeTroops(1_999_999_999n)).toBe(1);
  });
});
