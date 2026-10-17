import { safeInteger } from "./safe-integer";
import { type ID, StructureType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "../managers/config-manager";
import { structureMapPosition } from "./expeditions";
import { journeyDistance } from "./travel";

/** A bank and its distance from a structure in hex steps, one way. */
type ClosestBank = { bankId: ID; distance: number };

/** The bank nearest a structure on its layer, as the chain measures a journey; the lower id breaks a tie. */
export const getClosestBank = (entityId: ID, store: NativeFactStore): ClosestBank | undefined => {
  const game = configManager.getActiveGameId();
  const structure = store.require("Structure", { game_id: game, entity_id: entityId });
  const position = structureMapPosition(store, structure);
  if (!position) return undefined;
  const banks = [...store.inGame("Structure", game)].filter(
    (row) => row.base.category === StructureType.Bank && structureMapPosition(store, row)?.alt === position.alt,
  );
  return banks
    .flatMap((bank) => {
      const bankPosition = structureMapPosition(store, bank);
      if (!bankPosition) return [];
      return [{ bankId: safeInteger(bank.entity_id), distance: journeyDistance(bankPosition, position) }];
    })
    .toSorted((a, b) => a.distance - b.distance || a.bankId - b.bankId)[0];
};
