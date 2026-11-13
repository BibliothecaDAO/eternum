import { expect, it } from "vitest";

import { chainOf, keyedAsHeldOnChain, type LabCommand } from "./lab-chain";
import { relicsScenario } from "./relics-scenario";

/** ApplyRelic as the play call carries it: four header felts, the variant, the army, the relic id, ArmySlot, the slot. */
const applyRelic = (relicId: number, slot: number): LabCommand => ({
  kind: "ApplyRelic",
  fields: {},
  calldata: ["0", "0", "0", "0", "43", "201", String(relicId), "3", String(slot)],
});

it("answers ApplyRelic as army_relics.cairo applies it: the slot spent, its kind running 30 minutes a tier", () => {
  const scenario = relicsScenario();
  const chain = chainOf(scenario);
  const now = scenario.startsAt + 10;
  // The Common Tome in the second slot: id 4 × 5 + 1.
  const answered = scenario.answer(applyRelic(21, 1), chain, now);
  // The chain carries answers as Herald does: plain JSON.
  expect(() => JSON.stringify(answered)).not.toThrow();
  // Keyed as the chain holds each row, as the lab's Herald applies an answer.
  chain.applyFacts(answered.map(keyedAsHeldOnChain) as never);
  const carried = chain.require("ArmyRelics", { game_id: 1, explorer_id: 201 });
  expect([carried.first?.kind, carried.second, carried.third?.kind]).toEqual(["Blade", null, "Plunder"]);
  const tome = chain.require("ArmyRelicEffect", { game_id: 1, explorer_id: 201, kind: "Tome" });
  expect([tome.rank, tome.expires_at]).toEqual([1, BigInt(now + 1_800)]);
});

it("answers nothing for a relic id the slot does not hold, as the contract refuses stale input", () => {
  const scenario = relicsScenario();
  expect(scenario.answer(applyRelic(22, 1), chainOf(scenario), scenario.startsAt)).toEqual([]);
});
