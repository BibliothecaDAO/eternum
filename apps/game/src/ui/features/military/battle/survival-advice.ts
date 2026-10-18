import { configManager, getEntityName, getIsBlitz } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { StructureType, type ID, type Troops, rankName } from "@bibliothecadao/types";

import {
  fieldArmyTroops,
  formatTroopTypeLabel,
  hasFreeFieldArmySlot,
  readFieldArmyRoom,
} from "../components/unified-army-creation-modal/field-army-room";
import { describeSurvivalAdvice, wholeTroops } from "./fight-forecast";

/**
 * What would survive a certain loss, within what the player can raise: the army's home realm's cap, its next level,
 * or another realm of theirs that can raise the army by the Military window's own rule (a free field army slot, a cap
 * that holds it, and the troops on hand, else the troops to train there first). `armyId` is null for a guard.
 */
export const readSurvivalAdvice = (
  store: NativeFactStore,
  army: { id: ID | null; troops: Pick<Troops, "category" | "tier" | "count"> },
  extraToSurvive: bigint,
  tick: number,
): string => {
  const game = configManager.getActiveGameId();
  const { category, tier } = army.troops;
  const extra = wholeTroops(extraToSurvive);
  const current = wholeTroops(army.troops.count);
  const troop = `${tier} ${formatTroopTypeLabel(category)}`;
  const explorer = army.id === null ? undefined : store.get("ExplorerTroops", { game_id: game, explorer_id: army.id });
  const home = explorer ? store.get("Structure", { game_id: game, entity_id: Number(explorer.owner) }) : undefined;
  if (!home) return describeSurvivalAdvice({ extra, current, troop, home: null, nextLevel: null, source: null });

  const nameOf = (row: NativeRows["Structure"]) =>
    getEntityName(Number(row.entity_id), store, getIsBlitz()) ?? "Your realm";
  const level = Number(home.base.level);
  const nextLevel =
    level < configManager.getMaxLevel(StructureType.Realm)
      ? { name: rankName(level + 1), cap: configManager.getMaxArmySize(level + 1, tier) }
      : null;
  const total = current + extra;
  const source =
    [...store.structuresOwnedBy(game, home.owner)]
      .filter((row) => row.entity_id !== home.entity_id && Number(row.base.category) === StructureType.Realm)
      .map((row) => ({ row, room: readFieldArmyRoom(store, row, { type: category, tier }, tick) }))
      .filter(({ room }) => hasFreeFieldArmySlot(room) && room.cap >= total)
      .map(({ row, room }) => ({ name: nameOf(row), cap: room.cap, short: Math.max(0, total - fieldArmyTroops(room)) }))
      .toSorted((left, right) => left.short - right.short)[0] ?? null;
  return describeSurvivalAdvice({
    extra,
    current,
    troop,
    home: { name: nameOf(home), cap: configManager.getMaxArmySize(level, tier) },
    nextLevel,
    source,
  });
};
