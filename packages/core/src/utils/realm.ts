import { structureMapPosition } from "./expeditions";
import { ID, RealmInfo } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager, ResourceManager } from "..";
import type { PlayerNameResolver } from "./entities";
import realmsJson from "../data/realms.json";
import { unpackValue } from "./packed-data";

export const getRealmNameById = (realmId: ID): string => {
  const features = realmsJson["features"][realmId - 1];
  if (!features) return "";
  return features["name"];
};

export function getRealmInfo(
  entity: ID,
  store: NativeFactStore,
  playerName: PlayerNameResolver,
): RealmInfo | undefined {
  const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entity });
  const structureBuildings = store.get("StructureBuildings", {
    game_id: configManager.getActiveGameId(),
    entity_id: entity,
  });

  if (structure) {
    const realm_id = structure.metadata.realm_id;
    const order = structure.metadata.order;
    const level = structure.base.level;
    const entity_id = structure.entity_id;
    const produced_resources = structure.resources_packed;

    const resources = unpackValue(BigInt(produced_resources));

    const resourceManager = new ResourceManager(store, entity_id);

    return {
      realmId: realm_id,
      entityId: entity_id,
      category: structure.base.category,
      level,
      resources,
      order,
      storehouses: resourceManager.getStoreCapacityKg(),
      position: structureMapPosition(store, structure),
      population: structureBuildings?.population.current,
      capacity: structureBuildings?.population.max,
      hasCapacity:
        !structureBuildings?.population ||
        structureBuildings.population.max + configManager.getBasePopulationCapacity() >
          structureBuildings.population.current,
      owner: structure?.owner,
      ownerName: structure.owner === 0n ? "" : (playerName(structure.owner) ?? ""),
      hasWonder: structure.metadata.has_wonder,
      structure,
    };
  }
}
