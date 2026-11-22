import { learnResearch } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { frontierSeasonOnePreset } from "../../../../../config/source/frontier/season-one";
import { actionsScenario } from "./actions-scenario";
import { wire, type LabScenario } from "./lab-chain";

export function townScenario(): LabScenario {
  const game = actionsScenario();
  const store = game.store;
  const home = store.require("Structure", { game_id: 1, entity_id: 7 });
  const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: 7 });
  const board = store.require("BoardRules", { game_id: 1 });
  const recipe = store.require("ProductionRecipe", { game_id: 1, resource_type: ResourcesIds.Knight });
  const learned = learnResearch(learnResearch(knowledge.learned, research.ROW_CONSCRIPTION), research.ROW_RATIONS);
  store.applyFacts([
    {
      model: "Structure",
      key: store.wireKeyOf("Structure", { game_id: 1, entity_id: 7 })!,
      value: wire({ ...home, base: { ...home.base, level: research.RATIONS_DEPOT_LEVEL } }),
    },
    {
      model: "RealmKnowledge",
      key: store.wireKeyOf("RealmKnowledge", { game_id: 1, structure_id: 7 })!,
      value: wire({ ...knowledge, learned }),
    },
    {
      model: "BoardRules",
      key: store.wireKeyOf("BoardRules", { game_id: 1 })!,
      value: wire({ ...board, ration_step: BigInt(frontierSeasonOnePreset.board.rationStep * RESOURCE_PRECISION) }),
    },
    {
      model: "ProductionRecipe",
      key: store.wireKeyOf("ProductionRecipe", { game_id: 1, resource_type: ResourcesIds.Crossbowman }) ?? "0x7101",
      value: wire({ ...recipe, resource_type: ResourcesIds.Crossbowman }),
    },
    {
      model: "ResourceBalance",
      key:
        store.wireKeyOf("ResourceBalance", { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Crossbowman }) ??
        "0x7102",
      value: wire({
        game_id: 1,
        entity_id: 7,
        resource_type: ResourcesIds.Crossbowman,
        balance: 600n * BigInt(RESOURCE_PRECISION),
      }),
    },
  ]);
  return game;
}
