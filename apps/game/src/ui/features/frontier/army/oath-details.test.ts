import { expect, it } from "vitest";
import { nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import { orders } from "@bibliothecadao/types";
import { oathEffectDescription, oathJob } from "./oath-details";

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

it("words every Oath the draw can offer and ties every contract Oath constant to its catalog job", () => {
  const expectedJobs: Record<number, "fight" | "stamina" | "prize"> = {
    [oaths.POWER]: "fight",
    [oaths.GIANTS]: "fight",
    [oaths.PROTECTION]: "fight",
    [oaths.SKILL]: "fight",
    [oaths.TWINS]: "fight",
    [oaths.VITRIOL]: "fight",
    [oaths.TITANS]: "stamina",
    [oaths.ANGER]: "stamina",
    [oaths.ENLIGHTENMENT]: "stamina",
    [oaths.FOX]: "stamina",
    [oaths.FURY]: "stamina",
    [oaths.DETECTION]: "prize",
    [oaths.BRILLIANCE]: "prize",
    [oaths.RAGE]: "prize",
    [oaths.PERFECTION]: "prize",
    [oaths.REFLECTION]: "prize",
  };
  const counts = { fight: 0, stamina: 0, prize: 0 };
  const playable = orders.filter((order) => order.orderId > 0);
  expect(playable).toHaveLength(16);
  for (const order of playable) {
    expect(order.oathJob).toBe(expectedJobs[order.orderId]);
    const job = oathJob(order.orderId);
    expect(job).toBe(expectedJobs[order.orderId]);
    expect(oathEffectDescription(order.orderId)).toMatch(/\S/);
    counts[job] += 1;
  }
  expect(counts).toEqual({ fight: 6, stamina: 5, prize: 5 });
  expect(() => oathEffectDescription(17)).toThrow();
  expect(() => oathJob(0)).toThrow();
  expect(() => oathJob(17)).toThrow();
});
