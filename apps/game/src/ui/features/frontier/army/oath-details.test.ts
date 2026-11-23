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

it("describes every playable Oath uniquely with its own rule and rejects unknown ids", () => {
  const expectedByOrder: Record<number, string> = {
    [oaths.VITRIOL]: `Loses ${oaths.VITRIOL_LOSS_PER_TICK} troops a tick in the Deep.`,
    [oaths.POWER]: `Deals ${oaths.POWER_DAMAGE_PERCENT}% more damage.`,
    [oaths.GIANTS]: `Takes ${oaths.GIANTS_REDUCTION_PERCENT}% less damage.`,
    [oaths.PROTECTION]: `Guarding a site, takes ${oaths.PROTECTION_REDUCTION_PERCENT}% less damage.`,
    [oaths.REFLECTION]: "A well refills 80% of the stamina bar, not 40%.",
    [oaths.DETECTION]: "Reveals find something 20% more often.",
    [oaths.BRILLIANCE]: "Reveals pay 25% more.",
    [oaths.RAGE]: "Beaten guards pay 25% more.",
    [oaths.ANGER]: "An attack costs 20 stamina.",
    [oaths.TITANS]: "+60 stamina now, and the stamina bar holds 60 more.",
    [oaths.ENLIGHTENMENT]: "Regains 33% more stamina each hour.",
    [oaths.FOX]: "A reveal costs 20% less stamina.",
    [oaths.SKILL]: "Deals 30% more on the attack that leaves its stamina under 10.",
    [oaths.FURY]: "An attack that beats its target gives back 50% of the stamina it cost.",
    [oaths.PERFECTION]: "A guard beaten with under 15% of the army lost pays 50% more.",
    [oaths.TWINS]: "Your largest army beside it adds 30% of its own damage to each attack.",
  };
  const playable = orders.filter((order) => order.orderId > 0);
  expect(playable).toHaveLength(16);
  expect(Object.keys(expectedByOrder)).toHaveLength(16);
  const descriptions = playable.map((order) => {
    expect(oathName(order.orderId)).toBe(order.orderName);
    const description = oathEffectDescription(order.orderId);
    expect(description).toBe(expectedByOrder[order.orderId]);
    return description;
  });
  expect(new Set(descriptions).size).toBe(16);
  expect(() => oathName(0)).toThrow();
  expect(() => oathEffectDescription(17)).toThrow();
});
