import { expect, it } from "vitest";
import { nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import { oathEffectDescription } from "./oath-details";

it("explains the implemented Deep loss on both Oath surfaces", () => {
  expect(oathEffectDescription(oaths.VITRIOL)).toBe(`Loses ${oaths.VITRIOL_LOSS_PER_TICK} troops a tick in the Deep.`);
  expect(oathEffectDescription(oaths.POWER)).toBe(`Deals ${oaths.POWER_DAMAGE_PERCENT}% more damage.`);
  expect(oathEffectDescription(oaths.GIANTS)).toBe(`Takes ${oaths.GIANTS_REDUCTION_PERCENT}% less damage.`);
  expect(oathEffectDescription(oaths.PROTECTION)).toBe(
    `Guarding a site, takes ${oaths.PROTECTION_REDUCTION_PERCENT}% less damage.`,
  );
  expect(oathEffectDescription(oaths.REFLECTION)).toBe("A well refills 80% of the stamina bar, not 40%.");
  expect(oathEffectDescription(oaths.DETECTION)).toBe("Reveals find something 20% more often.");
  expect(oathEffectDescription(oaths.BRILLIANCE)).toBe("Reveals pay 25% more.");
  expect(oathEffectDescription(oaths.RAGE)).toBe("Beaten guards pay 25% more.");
  expect(oathEffectDescription(oaths.SKILL)).toBeUndefined();
});
