import { expect, it } from "vitest";
import { nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import { oathEffectDescription } from "./oath-details";

it("explains the implemented Deep loss on both Oath surfaces", () => {
  expect(oathEffectDescription(oaths.VITRIOL)).toBe(`Loses ${oaths.VITRIOL_LOSS_PER_TICK} troops a tick in the Deep.`);
  expect(oathEffectDescription(oaths.POWER)).toBeUndefined();
});
