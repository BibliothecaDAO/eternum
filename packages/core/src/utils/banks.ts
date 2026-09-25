import { EntityType, type ID, StructureType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "../managers/config-manager";
import { structureMapPosition } from "./expeditions";
import { calculateDistance } from "./utils";

export type ClosestBank = { bankId: ID; distance: number; travelTime: number };

export const getClosestBank = (entityId: ID, store: NativeFactStore): ClosestBank | undefined => {
  const game = configManager.getActiveGameId();
  const structure = store.require("Structure", { game_id: game, entity_id: entityId });
  const position = structureMapPosition(store, structure);
  const speed = configManager.getSpeedConfig(EntityType.DONKEY);
  const banks = [...store.inGame("Structure", game)].filter(
    (row) => row.base.category === StructureType.Bank && structureMapPosition(store, row).alt === position.alt,
  );
  return banks
    .map((bank) => {
      const distance = calculateDistance(structureMapPosition(store, bank), position) * 2;
      return { bankId: bank.entity_id, distance, travelTime: Math.floor((distance * speed) / 60) };
    })
    .toSorted((a, b) => a.distance - b.distance || a.bankId - b.bankId)[0];
};
