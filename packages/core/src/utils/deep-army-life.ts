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
  tickSeconds: number;
}

export function deepArmyLife(store: NativeFactStore, army: NativeRows["ExplorerTroops"], now: number): DeepArmyLife {
  return deepTroopsLife(store, army.game_id, army.troops.count, armyDeepLossPerTick(store, army), now);
}

export function deepTroopsLife(
  store: NativeFactStore,
  game_id: number,
  troops: bigint,
  lossPerTick: bigint,
  now: number,
): DeepArmyLife {
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
    tickSeconds: interval,
  };
}

export function armyDrain(
  store: NativeFactStore,
  army: NativeRows["ExplorerTroops"],
  now: number,
): DeepArmyLife | undefined {
  const key = { game_id: army.game_id, explorer_id: army.explorer_id };
  if (!store.get("DeepArmy", key)) return undefined;
  return deepArmyLife(store, currentArmy(store, army, now), now);
}
