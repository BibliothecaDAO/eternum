import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { seasonOneResearchPrices } from "./season-one-research";
import { researchScenario } from "./research-scenario";
import { wire, type LabScenario } from "./lab-chain";

export function oathSlotsScenario(): LabScenario {
  const game = researchScenario();
  const store = game.store;
  const precision = BigInt(RESOURCE_PRECISION);
  const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: 7 });
  const facts = [
    {
      model: "RealmKnowledge",
      key: store.wireKeyOf("RealmKnowledge", { game_id: 1, structure_id: 7 })!,
      value: wire({ ...knowledge, learned: 0n }),
    },
    ...seasonOneResearchPrices(store),
    ...[
      [ResourcesIds.Essence, 20000],
      [ResourcesIds.Labor, 5000],
    ].map(([resource_type, balance]) => ({
      model: "ResourceBalance",
      key: store.wireKeyOf("ResourceBalance", { game_id: 1, entity_id: 7, resource_type: resource_type! })!,
      value: wire({ game_id: 1, entity_id: 7, resource_type, balance: BigInt(balance!) * precision }),
    })),
  ];
  store.applyFacts(facts as never);
  return game;
}
