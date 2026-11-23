import { expect, it } from "vitest";
import { nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import { orders } from "@bibliothecadao/types";
import { oathEffectDescription, oathName } from "./oath-details";

it("explains the implemented Deep loss on both Oath surfaces", () => {
  expect(oathEffectDescription(oaths.VITRIOL)).toBe(`Loses ${oaths.VITRIOL_LOSS_PER_TICK} troops a tick in the Deep.`);
  expect(oathEffectDescription(oaths.POWER)).toBe(`Deals ${oaths.POWER_DAMAGE_PERCENT}% more damage.`);
  expect(oathEffectDescription(oaths.GIANTS)).toBe(`Takes ${oaths.GIANTS_REDUCTION_PERCENT}% less damage.`);
  expect(oathEffectDescription(oaths.PROTECTION)).toBe(
    `Guarding a site, takes ${oaths.PROTECTION_REDUCTION_PERCENT}% less damage.`,
  );
  expect(oathEffectDescription(oaths.REFLECTION)).toBe("A well refills 80% of the stamina bar, not 40%.");
  expect(oathEffectDescription(oaths.DETECTION)).toBe(
    "After 4 empty reveals in a row, the next reveal is sure to find something.",
  );
  expect(oathEffectDescription(oaths.BRILLIANCE)).toBe("Reveals pay 25% more.");
  expect(oathEffectDescription(oaths.RAGE)).toBe("Beaten guards pay 25% more.");
  expect(oathEffectDescription(oaths.ANGER)).toBe("An attack costs 20 stamina.");
  expect(oathEffectDescription(oaths.TITANS)).toBe("+60 stamina now, and the stamina bar holds 60 more.");
  expect(oathEffectDescription(oaths.ENLIGHTENMENT)).toBe("Regains 33% more stamina each hour.");
  expect(oathEffectDescription(oaths.FOX)).toBe("A reveal costs 20% less stamina.");
  expect(oathEffectDescription(oaths.SKILL)).toBe("Deals 30% more on the attack that leaves its stamina under 10.");
  expect(oathEffectDescription(oaths.FURY)).toBe(
    "An attack that beats its target gives back 50% of the stamina it cost.",
  );
  expect(oathEffectDescription(oaths.PERFECTION)).toBe("A guard beaten with under 15% of the army lost pays 50% more.");
  expect(oathEffectDescription(oaths.TWINS)).toBe(
    "Your largest army beside it adds 30% of its own damage to each attack.",
  );
});

it("describes every playable Oath and rejects unknown ids", () => {
  const playable = orders.filter((order) => order.orderId > 0);
  expect(playable).toHaveLength(16);
  expect(oathName(oaths.VITRIOL)).toBe("Vitriol");
  for (const order of playable) {
    expect(oathName(order.orderId)).toBe(order.orderName);
    expect(oathEffectDescription(order.orderId).length).toBeGreaterThan(0);
  }
  expect(() => oathName(0)).toThrow();
  expect(() => oathEffectDescription(17)).toThrow();
});
