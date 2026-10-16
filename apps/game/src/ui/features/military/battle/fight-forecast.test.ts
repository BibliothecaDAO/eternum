import type { FightForecast } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";
import { combatTitle, describeFightCost, wholeTroops } from "./fight-forecast";

const troops = (whole: number) => ({ count: BigInt(whole) * 1_000_000_000n }) as never;

type FoughtForecast = Exclude<FightForecast, { outcome: "refused" }>;

const fight = (overrides: Partial<FoughtForecast>): FightForecast => ({
  outcome: "wins",
  exchanges: 2,
  firstExchange: { attackerLoss: 250n * 1_000_000_000n, defenderLoss: 600n * 1_000_000_000n },
  attackerLoss: 420n * 1_000_000_000n,
  defenderLoss: 1_100n * 1_000_000_000n,
  staminaSpent: 60n,
  attacker: troops(1_078),
  defender: troops(0),
  ...overrides,
});

describe("combatTitle", () => {
  it("names the two sides in full, an unowned target as the Bandits", () => {
    expect(combatTitle("djizus", { loaded: true, owner: "Stolsli of the North" })).toBe(
      "djizus vs Stolsli of the North",
    );
    expect(combatTitle("djizus", { loaded: true, owner: null })).toBe("djizus vs Bandits");
    expect(combatTitle(null, { loaded: true, owner: "Stolsli" })).toBe("Your army vs Stolsli");
  });

  it("names only the attacker before the target is known, and never the fight's outcome", () => {
    expect(combatTitle("djizus", { loaded: false, owner: null })).toBe("djizus");
  });
});

describe("describeFightCost", () => {
  it("counts a finished fight's exchanges and stamina, whoever wins", () => {
    expect(describeFightCost(fight({}))).toBe("2 exchanges · 60 stamina");
    expect(describeFightCost(fight({ outcome: "loses", exchanges: 1, staminaSpent: 30n }))).toBe(
      "1 exchange · 30 stamina",
    );
  });

  it("says when the fight stops before it is decided, by stamina or by cooldown", () => {
    expect(describeFightCost(fight({ outcome: "stalls", exchanges: 5, defender: troops(300) }))).toBe(
      "Out of stamina after 5 exchanges",
    );
    expect(
      describeFightCost(fight({ outcome: "stalls", exchanges: 1, stoppedBy: "cooldown", staminaSpent: 30n })),
    ).toBe("One attack, then cooldown · 30 stamina");
  });

  it("has nothing to say when the first attack cannot be made", () => {
    expect(describeFightCost({ outcome: "refused", refusal: "insufficient-stamina" })).toBeNull();
  });
});

it("counts whole troops as the contract does", () => {
  expect(wholeTroops(1_999_999_999n)).toBe(1);
});
