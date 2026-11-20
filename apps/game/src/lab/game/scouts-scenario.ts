import { nativeResearchConstants as research, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { actionsScenario } from "./actions-scenario";
import { wire, type LabScenario } from "./lab-chain";

export function seedScouts(store: NativeFactStore): void {
  const home = store.require("Structure", { game_id: 1, entity_id: 7 });
  const recipe = store.require("ProductionRecipe", { game_id: 1, resource_type: ResourcesIds.Knight });
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
  ]);
}

export function scoutsScenario(): LabScenario {
  const game = actionsScenario();
  seedScouts(game.store);
  return game;
}
