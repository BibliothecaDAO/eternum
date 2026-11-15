import { learnResearch } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { actionsScenario } from "./actions-scenario";
import { wire, type LabScenario } from "./lab-chain";

/** A City's two troop stocks, with Scouting I researched and enough wheat to choose either army. */
export function seedScouts(store: NativeFactStore): void {
  const home = store.require("Structure", { game_id: 1, entity_id: 7 });
  const recipe = store.require("ProductionRecipe", { game_id: 1, resource_type: ResourcesIds.Knight });
  const learned = store.require("RealmKnowledge", { game_id: 1, structure_id: 7 }).learned;
  store.applyFacts([
    {
      model: "Structure",
      key: store.wireKeyOf("Structure", { game_id: 1, entity_id: 7 })!,
      value: wire({ ...home, base: { ...home.base, level: research.SCOUTS_LODGE_LEVEL } }),
    },
    {
      model: "ProductionRecipe",
      key: store.wireKeyOf("ProductionRecipe", { game_id: 1, resource_type: ResourcesIds.Paladin }) ?? "0x5c01",
      value: wire({ ...recipe, resource_type: ResourcesIds.Paladin }),
    },
    {
      model: "ResourceBalance",
      key:
        store.wireKeyOf("ResourceBalance", { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Paladin }) ??
        "0x5c02",
      value: wire({
        game_id: 1,
        entity_id: 7,
        resource_type: ResourcesIds.Paladin,
        balance: 600n * BigInt(RESOURCE_PRECISION),
      }),
    },
    {
      model: "RealmKnowledge",
      key: store.wireKeyOf("RealmKnowledge", { game_id: 1, structure_id: 7 })!,
      value: wire({
        game_id: 1,
        structure_id: 7,
        learned: learnResearch(learned, research.ROW_SCOUTS_LODGE, research.KIND_CAMPS),
      }),
    },
  ]);
}

export function scoutsScenario(): LabScenario {
  const game = actionsScenario();
  seedScouts(game.store);
  return game;
}
