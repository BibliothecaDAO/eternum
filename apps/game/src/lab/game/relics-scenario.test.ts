import { expect, it } from "vitest";

import { chainOf, keyedAsHeldOnChain, type LabCommand } from "./lab-chain";
import { relicsScenario } from "./relics-scenario";

const applyRelic = (kindIndex: number, expectedRank: number): LabCommand => ({
  kind: "ApplyRelic",
  fields: {},
  span: ["43", "201", String(kindIndex), String(expectedRank)],
});

it("answers ApplyRelic as army_relics.cairo applies it: the slot spent, its kind running 30 minutes a tier", () => {
  const scenario = relicsScenario();
  const chain = chainOf(scenario);
  const now = scenario.startsAt + 10;
  const answered = scenario.answer(applyRelic(1, 1), chain, now);
  expect(() => JSON.stringify(answered)).not.toThrow();
  chain.applyFacts(answered.map(keyedAsHeldOnChain) as never);
  const carried = chain.require("ArmyRelics", { game_id: 1, explorer_id: 201 });
  expect([carried.blade, carried.ward, carried.plunder, carried.stamina_regen, carried.antidote]).toEqual([
    2, 0, 3, 0, 2,
  ]);
  const ward = chain.require("ArmyRelicEffect", { game_id: 1, explorer_id: 201, kind: "Ward" });
  expect([ward.rank, ward.expires_at]).toEqual([1, BigInt(now + 1_800)]);
});

it("answers nothing for a rank the kind slot does not hold, as the contract refuses stale input", () => {
  const scenario = relicsScenario();
  expect(scenario.answer(applyRelic(1, 4), chainOf(scenario), scenario.startsAt)).toEqual([]);
});
