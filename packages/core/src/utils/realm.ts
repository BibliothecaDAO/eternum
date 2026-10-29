import { safeInteger } from "./safe-integer";
import { structureMapPosition } from "./expeditions";
import { ID, RealmInfo } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager, ResourceManager } from "..";
import type { PlayerNameResolver } from "./entities";
import { canonicalRealm } from "./canonical-realm";
import { unpackValue } from "./packed-data";

/** A Realm's canonical name; none for a number that is no Realm's. */
export const getRealmNameById = (realmId: ID): string => {
  try {
    return canonicalRealm(realmId).name;
  } catch {
    return "";
  }
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

  const position = structure && structureMapPosition(store, structure);
  if (structure && position) {
    const realm_id = structure.metadata.realm_id;
    const order = structure.metadata.order;
    const level = structure.base.level;
    const entity_id = structure.entity_id;
    const produced_resources = structure.resources_packed;

    const resources = unpackValue(BigInt(produced_resources));

    const resourceManager = new ResourceManager(store, safeInteger(entity_id));

    return {
      realmId: realm_id,
      entityId: safeInteger(entity_id),
      category: structure.base.category,
      level,
      resources,
      order,
      storehouses: resourceManager.getStoreCapacityKg(),
      position,
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
