import { describe, expect, it } from "vitest";
import { nativeRuleConstants as rule } from "@bibliothecadao/eternum/game-client";

import { RELIC_WORDS } from "@/ui/design-system/kit/words";

import { RELIC_KINDS } from "@/ui/design-system/domain-icon-meaning";
import { relicEffect, relicId, relicName, relicSeconds } from "./relic-catalog";

describe("the relic catalog", () => {
  it("names a relic by its tier and kind", () => {
    expect(relicName({ kind: "Blade", rank: 3 })).toBe("Rare Blade");
    expect(relicName({ kind: "Ward", rank: 5 })).toBe("Legendary Ward");
  });

  it("contextualizes each relic kind from the live game base rule to its boosted value", () => {
    expect(rule.RELIC_BLADE_BPS).toBe(1000);
    expect(relicEffect({ kind: "Blade", rank: 3 }, { staminaPerSecond: 1 / 120 })).toBe("Damage dealt: 100% → 130%");
    expect(relicEffect({ kind: "Ward", rank: 5 }, { staminaPerSecond: 1 / 120 })).toBe(
      "Damage taken: 100% → 75% (less)",
    );
    expect(relicEffect({ kind: "Plunder", rank: 2 }, { staminaPerSecond: 1 / 120 })).toBe(
      "Cleared site labor & Essence: 100% → 140%",
    );
    expect(relicEffect({ kind: "StaminaRegen", rank: 3 }, { staminaPerSecond: 1 / 120 })).toBe(
      "Stamina recovery: +0.5/min → +0.8/min",
    );
    expect(relicEffect({ kind: "StaminaRegen", rank: 3 }, { staminaPerSecond: 1 / 20 })).toBe(
      "Stamina recovery: +3/min → +5/min",
    );
    expect(relicEffect({ kind: "StaminaRegen", rank: 3 }, {})).toBe("Stamina recovery: 100% → 160%");
  });

  it("works the game's relic seconds a tier: 30 minutes in Season 1, 7.5 at four times the speed", () => {
    expect(relicSeconds({ kind: "Ward", rank: 2 }, { relic_seconds_per_rank: 1_800 })).toBe(3_600);
    expect(relicSeconds({ kind: "Blade", rank: 5 }, { relic_seconds_per_rank: 1_800 })).toBe(9_000);
    expect(relicSeconds({ kind: "Blade", rank: 5 }, { relic_seconds_per_rank: 450 })).toBe(2_250);
  });

  it("gives ApplyRelic the id the contract decodes: the kind's index × 5 + the tier", () => {
    expect(RELIC_KINDS).toEqual(["Blade", "Ward", "Plunder", "StaminaRegen"]);
    expect(relicId({ kind: "Blade", rank: 1 })).toBe(1);
    expect(relicId({ kind: "Plunder", rank: 3 })).toBe(13);
    expect(relicId({ kind: "StaminaRegen", rank: 5 })).toBe(20);
  });

  it("names every kind the contract has and never names Far-Eye", () => {
    expect(Object.keys(RELIC_WORDS.kinds)).toEqual([...RELIC_KINDS]);
    expect(Object.values(RELIC_WORDS.kinds).join(" ")).not.toMatch(/far.?eye/i);
  });
});
