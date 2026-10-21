import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";
import { type NativeFactStore, type NativeRows, safeInteger } from "@bibliothecadao/eternum/game-client";
import type { ID } from "@bibliothecadao/types";
import { useMemo } from "react";

/** A realm's population as the contract counts it: what its buildings take, of what its castle and Huts give. */
export type RealmPopulation = { used: number; total: number };

const POPULATION_MODELS = ["StructureBuildings"] as const;

/** The realm's population; unknown until its buildings' row is read. */
export const readRealmPopulation = (store: NativeFactStore, entityId: ID): RealmPopulation | undefined => {
  const row = store.get("StructureBuildings", { game_id: configManager.getActiveGameId(), entity_id: entityId });
  if (!row) return undefined;
  return { used: row.population.current, total: row.population.max + configManager.getBasePopulationCapacity() };
};

/** The realm's population, read again whenever its buildings change. */
export const useRealmPopulation = (realm: NativeRows["Structure"]): RealmPopulation | undefined => {
  const facts = useNativeFacts(POPULATION_MODELS);
  return useMemo(() => readRealmPopulation(facts.store, safeInteger(realm.entity_id)), [realm.entity_id, facts]);
};
