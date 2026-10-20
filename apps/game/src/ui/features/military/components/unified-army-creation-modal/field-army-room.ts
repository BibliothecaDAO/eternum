import { knownAmount } from "@/ui/utils/utils";
import { configManager, getBalance, getTroopResourceId, liveHomeArmies } from "@bibliothecadao/eternum";
import { type NativeFactStore, type NativeRows, safeInteger } from "@bibliothecadao/eternum/game-client";
import { type ID, type ResourcesIds, TroopType, type TroopTier } from "@bibliothecadao/types";

import { resolveArmyTroopAvailability } from "./army-creation-policy";

type Store = NativeFactStore;

/** A troop as the Military window names it: "Crossbow", "Knight", "Paladin". */
export const formatTroopTypeLabel = (type: TroopType) => (type === TroopType.Crossbowman ? "Crossbow" : type);

/**
 * Whole troops of one kind a structure holds, as far as this client sees: an army takes whole troops, and troops it
 * cannot see can't join one.
 */
export const heldTroops = (store: Store, structureId: ID, resourceId: ResourcesIds, tick: number): number =>
  Math.floor(knownAmount(getBalance(structureId, resourceId, tick, store).balance) ?? 0);

/** What a new field army of one troop can take from a structure now. */
interface FieldArmyRoom {
  /** Whole troops of that kind on hand. */
  held: number;
  /** Its living field armies, each filling a slot. */
  armies: number;
  /** Its field army slots. */
  maxArmies: number;
  /** The most troops of that tier one army can hold at its level. */
  cap: number;
}

export const readFieldArmyRoom = (
  store: Store,
  structure: NativeRows["Structure"],
  troop: { type: TroopType; tier: TroopTier },
  tick: number,
): FieldArmyRoom => {
  const id = safeInteger(structure.entity_id);
  return {
    held: heldTroops(store, id, getTroopResourceId(troop.type, troop.tier), tick),
    armies: liveHomeArmies(store, id, structure.game_id).length,
    maxArmies: Number(structure.base.troop_max_explorer_count),
    cap: configManager.getMaxArmySize(Number(structure.base.level), troop.tier),
  };
};

/** A structure raises another field army only while its living armies leave a slot free. */
export const hasFreeFieldArmySlot = (room: Pick<FieldArmyRoom, "armies" | "maxArmies">): boolean =>
  room.armies < room.maxArmies;

/** The most troops a new field army can take from the structure now: none without a free slot, else its troops up to the cap. */
export const fieldArmyTroops = (room: FieldArmyRoom): number =>
  hasFreeFieldArmySlot(room) ? resolveArmyTroopAvailability(room.held, room.cap) : 0;
