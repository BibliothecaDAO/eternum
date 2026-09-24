import { EntityType, type ID, StructureType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "../managers/config-manager";
import { calculateDistance } from "./utils";

export type ClosestBank = { bankId: ID; distance: number; travelTime: number };

export const getClosestBank = (entityId: ID, store: NativeFactStore): ClosestBank | undefined => {
  const game = configManager.getActiveGameId();
  const structure = store.require("Structure", { game_id: game, entity_id: entityId });
  const speed = configManager.getSpeedConfig(EntityType.DONKEY);
  const banks = [...store.inGame("Structure", game)].filter(
    (row) => row.base.category === StructureType.Bank && row.base.alt === structure.base.alt,
  );
  return banks
    .map((bank) => {
      const distance =
        calculateDistance(
          { x: bank.base.coord_x, y: bank.base.coord_y },
          { x: structure.base.coord_x, y: structure.base.coord_y },
        ) * 2;
      return { bankId: bank.entity_id, distance, travelTime: Math.floor((distance * speed) / 60) };
    })
    .toSorted((a, b) => a.distance - b.distance || a.bankId - b.bankId)[0];
};
