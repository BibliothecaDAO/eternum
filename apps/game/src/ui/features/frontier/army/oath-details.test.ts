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
  expect(oathEffectDescription(oaths.SKILL)).toBeUndefined();
});
