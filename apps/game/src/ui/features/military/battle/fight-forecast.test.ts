import { displayPlayerName, type FightForecast } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";
import {
  aboutTroops,
  combatTitle,
  describeFightCost,
  describeSurvivalAdvice,
  extraTroopsToSurvive,
  wholeTroops,
} from "./fight-forecast";

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
  it("names the two sides in full", () => {
    expect(combatTitle("djizus", "Stolsli of the North")).toBe("djizus vs Stolsli of the North");
    expect(combatTitle("djizus", displayPlayerName("0x0", null))).toBe("djizus vs The Vanguard");
    expect(combatTitle(null, "Stolsli")).toBe("Your army vs Stolsli");
  });

  it("names only the attacker before the target is known, and never the fight's outcome", () => {
    expect(combatTitle("djizus", null)).toBe("djizus");
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

describe("how many more troops would survive a certain loss", () => {
  const unit = 1_000_000_000n; // one troop at the contract's precision
  it("finds the smallest army that comes through, less the one the attacker has", () => {
    // This defender kills 1,650 troops: 1,651 survive.
    const survives = (count: bigint) => count > 1_650n * unit;
    const extra = extraTroopsToSurvive(1_000n * unit, survives)!;
    expect(Number(extra / unit)).toBeGreaterThanOrEqual(651);
    expect(Number(extra / unit)).toBeLessThanOrEqual(652);
  });

  it("is zero for an army that already survives, and null when not even 64 times it would", () => {
    expect(extraTroopsToSurvive(1_000n * unit, () => true)).toBe(0n);
    expect(extraTroopsToSurvive(1_000n * unit, () => false)).toBeNull();
  });

  it("reads as an estimate, rounded up to two significant figures", () => {
    expect(aboutTroops(651)).toBe("660");
    expect(aboutTroops(1_234)).toBe("1,300");
    expect(aboutTroops(48)).toBe("48");
  });

  it("stays exact where rounding up would pass the most that fits, and never rounds down", () => {
    expect(aboutTroops(499, 499)).toBe("499");
    expect(aboutTroops(1_234, 1_299)).toBe("1,234");
    expect(aboutTroops(1_234, 1_300)).toBe("1,300");
  });
});

describe("what a newcomer can do about a certain loss", () => {
  const egonal = { name: "Egonal", cap: 1_500 };
  const advice = (input: Partial<Parameters<typeof describeSurvivalAdvice>[0]>) =>
    describeSurvivalAdvice({
      extra: 400,
      current: 1_000,
      troop: "T1 Knight",
      home: egonal,
      nextLevel: null,
      source: null,
      ...input,
    });

  it("asks for the troops to add when the army's realm can hold them", () => {
    expect(advice({})).toBe("about 400 more troops to survive it");
  });

  it("never asks for more troops than the cap that holds the army (1,001 plus 499 against 1,500)", () => {
    expect(advice({ extra: 499, current: 1_001 })).toBe("about 499 more troops to survive it");
  });

  it("names the cap and what lifts it when the army would outgrow its realm (the audit's 2,400 against 1,500)", () => {
    expect(
      advice({
        extra: 1_400,
        nextLevel: { name: "City", cap: 15_000 },
        source: { name: "'oak Leukue", cap: 7_500, short: 0 },
      }),
    ).toBe(
      "it needs about 2,400 troops, and Egonal's army cap is 1,500: level it to City (cap 15,000), or raise one from 'oak Leukue (cap 7,500)",
    );
  });

  it("says the troops to train first at a realm with room for the army but not the troops", () => {
    expect(advice({ extra: 1_400, source: { name: "Empty", cap: 15_000, short: 2_351 } })).toBe(
      "it needs about 2,400 troops, and Egonal's army cap is 1,500: train 2,400 more T1 Knight at Empty and raise one there (cap 15,000)",
    );
  });

  it("reads the total within the smallest cap offered", () => {
    expect(advice({ extra: 1_001, nextLevel: { name: "Town", cap: 2_050 } })).toBe(
      "it needs about 2,001 troops, and Egonal's army cap is 1,500: level it to Town (cap 2,050)",
    );
  });

  it("offers only what would hold the army, and says when nothing within reach would", () => {
    expect(advice({ extra: 30_000, nextLevel: { name: "City", cap: 15_000 } })).toBe(
      "it needs about 31,000 troops, and Egonal's army cap is 1,500; no realm of yours can raise that many yet",
    );
  });
});
