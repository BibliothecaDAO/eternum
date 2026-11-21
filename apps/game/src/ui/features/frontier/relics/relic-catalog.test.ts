import { describe, expect, it } from "vitest";
import { nativeRuleConstants as rule } from "@bibliothecadao/eternum/game-client";

import { RELIC_WORDS } from "@/ui/design-system/kit/words";

import { RELIC_KINDS, relicEffect, relicId, relicName, relicSeconds } from "./relic-catalog";

describe("the relic catalog", () => {
  it("names a relic by its tier and kind", () => {
    expect(relicName({ kind: "Blade", rank: 3 })).toBe("Rare Blade");
    expect(relicName({ kind: "Ward", rank: 5 })).toBe("Legendary Ward");
  });

  it("says what each kind does at a tier, one step a tier, from the contract's own numbers", () => {
    expect(rule.RELIC_BLADE_BPS).toBe(1000);
    expect(relicEffect({ kind: "Blade", rank: 3 })).toBe("+30% damage dealt");
    expect(relicEffect({ kind: "Ward", rank: 5 })).toBe("−25% damage taken");
    expect(relicEffect({ kind: "Plunder", rank: 2 })).toBe("+40% labor and Essence from a cleared site");
    expect(relicEffect({ kind: "StaminaRegen", rank: 3 })).toBe(
      `+${3 * rule.STAMINA_REGEN_RELIC_STEP_PERCENT}% stamina regeneration`,
    );
  });

  it("works 30 minutes a tier", () => {
    expect(relicSeconds({ kind: "Ward", rank: 2 })).toBe(3_600);
    expect(relicSeconds({ kind: "Blade", rank: 5 })).toBe(9_000);
  });

  it("gives ApplyRelic the id the contract decodes: the kind's index × 5 + the tier", () => {
    expect(RELIC_KINDS).toEqual(["Blade", "Ward", "Plunder", "StaminaRegen"]);
    expect(relicId({ kind: "Blade", rank: 1 })).toBe(1);
    expect(relicId({ kind: "Plunder", rank: 3 })).toBe(13);
    expect(relicId({ kind: "StaminaRegen", rank: 5 })).toBe(20);
  });

  it("names every kind the contract has and no other", () => {
    expect(Object.keys(RELIC_WORDS.kinds)).toEqual([...RELIC_KINDS]);
  });
});
