import { learnResearch, researchTier } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { actionsScenario } from "./actions-scenario";
import { researchPriced } from "./day-end-scenario";
import { wire, type LabCommand, type LabFact, type LabScenario } from "./lab-chain";
import { balancesPaid } from "./spire-scenario";

/** Essence enough for every tier the realm can research today (2,000 a tier on the day-end lab's prices). */
const ESSENCE_HELD = 20_000n * BigInt(RESOURCE_PRECISION);

/**
 * The actions game with its research priced and Essence to pay (/lab/game?scenario=research). The chain answers
 * Research as construction.cairo's research applies it: the row's next tier learned with the side chosen, its Essence
 * and labor paid.
 */
export const researchScenario = (): LabScenario => {
  const actions = actionsScenario();
  const knowledge = actions.store.require("RealmKnowledge", { game_id: 1, structure_id: 7 });
  actions.store.applyFacts([
    ...researchPriced(),
    essenceHeld(actions.store),
    {
      model: "RealmKnowledge",
      key: actions.store.wireKeyOf("RealmKnowledge", knowledge)!,
      value: wire({ ...knowledge, learned: 0n }),
    },
  ] as never);
  return {
    ...actions,
    answer: (command, chain, now) =>
      command.kind === "Research" ? learnTheRow(command, chain) : actions.answer(command, chain, now),
  };
};

/** Realm 7's Essence, under the key its balance is held by when it has one. */
const essenceHeld = (store: NativeFactStore): LabFact => {
  const held = [...store.entries("ResourceBalance")].find(
    ([, row]) => row.entity_id === 7n && row.resource_type === ResourcesIds.Essence,
  );
  return {
    model: "ResourceBalance",
    key: held?.[0] ?? "0x1b20",
    value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Essence, balance: String(ESSENCE_HELD) },
  };
};

const learnTheRow = (command: LabCommand, chain: NativeFactStore): LabFact[] => {
  const structureId = BigInt(command.fields.structure_id);
  const row = Number(command.fields.row);
  const [key, knowledge] = [...chain.entries("RealmKnowledge")].find(([, held]) => held.structure_id === structureId)!;
  const learned = learnResearch(knowledge.learned, row);
  const price = chain.require("ResearchPrice", { game_id: 1, row, tier: researchTier(learned, row) });
  return [
    { model: "RealmKnowledge", key, value: wire({ ...knowledge, learned }) },
    ...balancesPaid(chain, structureId, [
      { resource: ResourcesIds.Essence, amount: price.essence },
      { resource: ResourcesIds.Labor, amount: price.labor },
    ]),
  ];
};
