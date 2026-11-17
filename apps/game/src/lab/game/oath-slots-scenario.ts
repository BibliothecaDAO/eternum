import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { frontierSeasonOnePreset } from "../../../../../config/source/frontier/season-one";
import { researchScenario } from "./research-scenario";
import { wire, type LabScenario } from "./lab-chain";

export function oathSlotsScenario(): LabScenario {
  const game = researchScenario();
  const store = game.store;
  const precision = BigInt(RESOURCE_PRECISION);
  const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: 7 });
  const facts = [
    { model: "RealmKnowledge", key: store.wireKeyOf("RealmKnowledge", { game_id: 1, structure_id: 7 })!, value: wire({ ...knowledge, learned: 0n }) },
    { model: "Building", key: "0x7500", value: wire({ game_id: 1, structure_id: 7, inner_col: 11, inner_row: 10, category: research.BARRACKS, paused: false, labor_paid: 0 }) },
    ...frontierSeasonOnePreset.research.map(({ row, tier, essenceCost, laborCost }) => ({
      model: "ResearchPrice",
      key: store.wireKeyOf("ResearchPrice", { game_id: 1, row, tier }) ?? `0x751${row.toString(16)}${tier}`,
      value: wire({ game_id: 1, row, tier, essence: BigInt(essenceCost) * precision, labor: BigInt(laborCost) * precision }),
    })),
    ...[[ResourcesIds.Essence, 20000], [ResourcesIds.Labor, 5000]].map(([resource_type, balance]) => ({
      model: "ResourceBalance",
      key: store.wireKeyOf("ResourceBalance", { game_id: 1, entity_id: 7, resource_type: resource_type! })!,
      value: wire({ game_id: 1, entity_id: 7, resource_type, balance: BigInt(balance!) * precision }),
    })),
  ];
  store.applyFacts(facts as never);
  return game;
}
