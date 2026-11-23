import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { dayOf } from "./days";
import { armyDeepLossPerTick, currentArmy } from "./deep";
import { readExpeditionRules } from "./expeditions";

/** What a Deep guard's troops can still do: how long they last at the army tick's loss, and how much of the day is left. */
export interface DeepArmyLife {
  lossPerTick: bigint;
  /** Ticks until the last troop falls, however long the day. */
  ticksToEmpty: number;
  /** Ticks left in the game day: the guard leaves with the day's end. */
  ticksInDay: number;
  /** Ticks the guard holds: the smaller of the two. */
  ticksLeft: number;
  secondsLeft: number;
}

export function deepArmyLife(store: NativeFactStore, army: NativeRows["ExplorerTroops"], now: number): DeepArmyLife {
  const { game_id } = army;
  const troops = army.troops.count;
  const lossPerTick = armyDeepLossPerTick(store, army);
  const interval = Number(store.require("SliceRules", { game_id }).tick_config.armies_tick_in_seconds);
  const calendar = readExpeditionRules(store, game_id);
  if (!calendar) throw new Error("Deep guards require expedition days");
  const day = dayOf(calendar, now);
  if (!day) throw new Error("Deep site is outside its season");
  const ticksToEmpty = Number((troops + lossPerTick - 1n) / lossPerTick);
  const ticksInDay = Math.floor(day.end / interval) - Math.floor(now / interval);
  const emptiesAt = (Math.floor(now / interval) + ticksToEmpty) * interval;
  return {
    lossPerTick,
    ticksToEmpty,
    ticksInDay,
    ticksLeft: Math.min(ticksToEmpty, ticksInDay),
    secondsLeft: Math.min(day.end, emptiesAt) - now,
  };
}

/**
 * What an army's place in the Deep costs it: its life at the tick's loss, from the troops it has now. Every army in the
 * Deep drains, whether it holds a site (DeepGuard) or waits in the field (DeepArmy); an army above the Deep has none.
 */
export function armyDrain(
  store: NativeFactStore,
  army: NativeRows["ExplorerTroops"],
  now: number,
): DeepArmyLife | undefined {
  const key = { game_id: army.game_id, explorer_id: army.explorer_id };
  if (!store.get("DeepArmy", key) && !store.get("DeepGuard", key)) return undefined;
  return deepArmyLife(store, currentArmy(store, army, now), now);
}
