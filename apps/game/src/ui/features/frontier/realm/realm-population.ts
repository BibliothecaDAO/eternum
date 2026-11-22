import { configManager } from "@bibliothecadao/eternum";
import { type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { ID } from "@bibliothecadao/types";

type RealmPopulation = { used: number; total: number };

export const readRealmPopulation = (store: NativeFactStore, entityId: ID): RealmPopulation | undefined => {
  const row = store.get("StructureBuildings", { game_id: configManager.getActiveGameId(), entity_id: entityId });
  if (!row) return undefined;
  return { used: row.population.current, total: row.population.max + configManager.getBasePopulationCapacity() };
};
