import { describe, expect, it } from "vitest";
import { nativeRuleConstants as rule } from "@bibliothecadao/eternum/game-client";

import { RELIC_KINDS, relicEffect, relicId, relicName, relicSeconds } from "./relic-catalog";

describe("the relic catalog", () => {
  it("names a relic by its tier and kind", () => {
    expect(relicName({ kind: "Blade", rank: 3 })).toBe("Rare Blade");
    expect(relicName({ kind: "FarEye", rank: 1 })).toBe("Common Far-Eye");
    expect(relicName({ kind: "Tome", rank: 5 })).toBe("Legendary Tome");
  });

  it("says what each kind does at a tier, one step a tier, from the contract's own numbers", () => {
    expect(rule.RELIC_BLADE_BPS).toBe(1000);
    expect(relicEffect({ kind: "Blade", rank: 3 })).toBe("+30% damage dealt");
    expect(relicEffect({ kind: "Ward", rank: 5 })).toBe("−25% damage taken");
    expect(relicEffect({ kind: "Plunder", rank: 2 })).toBe("+40% labor and Essence from a cleared site");
    expect(relicEffect({ kind: "Tome", rank: 1 })).toBe("+40% XP");
    expect(relicEffect({ kind: "FarEye", rank: 5 })).toBe("Reveals the 30 nearest tiles at once");
  });

  it("works 30 minutes a tier, the Far-Eye at once", () => {
    expect(relicSeconds({ kind: "Tome", rank: 2 })).toBe(3_600);
    expect(relicSeconds({ kind: "Blade", rank: 5 })).toBe(9_000);
    expect(relicSeconds({ kind: "FarEye", rank: 3 })).toBeNull();
  });

  it("gives ApplyRelic the id the contract decodes: the kind's index × 5 + the tier", () => {
    expect(RELIC_KINDS).toEqual(["Blade", "Ward", "Plunder", "FarEye", "Tome"]);
    expect(relicId({ kind: "Blade", rank: 1 })).toBe(1);
    expect(relicId({ kind: "Plunder", rank: 3 })).toBe(13);
    expect(relicId({ kind: "Tome", rank: 5 })).toBe(25);
  });
});
