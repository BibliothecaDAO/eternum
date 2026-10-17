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
});

describe("what a newcomer can do about a certain loss", () => {
  const egonal = { name: "Egonal", cap: 1_500 };
  it("asks for the troops to add when the army's realm can hold them", () => {
    expect(describeSurvivalAdvice({ extra: 400, current: 1_000, home: egonal, nextLevel: null, roomier: null })).toBe(
      "about 400 more troops to survive it",
    );
  });

  it("names the cap and what lifts it when the army would outgrow its realm (the audit's 2,400 against 1,500)", () => {
    expect(
      describeSurvivalAdvice({
        extra: 1_400,
        current: 1_000,
        home: egonal,
        nextLevel: { name: "City", cap: 15_000 },
        roomier: { name: "'oak Leukue", cap: 7_500 },
      }),
    ).toBe(
      "it needs about 2,400 troops, and Egonal's army cap is 1,500: level it to City (cap 15,000), or raise one from 'oak Leukue (cap 7,500)",
    );
  });

  it("offers only what would hold the army, and says when nothing within reach would", () => {
    expect(
      describeSurvivalAdvice({
        extra: 30_000,
        current: 1_000,
        home: egonal,
        nextLevel: { name: "City", cap: 15_000 },
        roomier: null,
      }),
    ).toBe("it needs about 31,000 troops, and Egonal's army cap is 1,500; no realm of yours holds that many yet");
  });
});
