import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { dayOf } from "./days";
import { armyDeepPoisonBreakdown, currentArmy, type DeepPoisonBreakdown } from "./deep";
import { readExpeditionRules } from "./expeditions";

export interface DeepArmyLife {
  lossPerTick: bigint;
  ticksToEmpty: number;
  ticksInDay: number;
  ticksLeft: number;
  secondsLeft: number;
  tickSeconds: number;
  breakdown?: DeepPoisonBreakdown;
}

export function deepArmyLife(store: NativeFactStore, army: NativeRows["ExplorerTroops"], now: number): DeepArmyLife {
  const breakdown = armyDeepPoisonBreakdown(store, army, now);
  if (breakdown.antidoteRank === 0) {
    return { ...deepTroopsLife(store, army.game_id, army.troops.count, breakdown.lossPerTick, now), breakdown };
  }
  const interval = Number(store.require("SliceRules", { game_id: army.game_id }).tick_config.armies_tick_in_seconds);
  const calendar = readExpeditionRules(store, army.game_id);
  if (!calendar) throw new Error("Deep guards require expedition days");
  const day = dayOf(calendar, now);
  if (!day) throw new Error("Deep site is outside its season");
  const currentTick = Math.floor(now / interval);
  const expiryTick = Math.floor(breakdown.antidoteExpiresAt / interval);
  const protectedTicks = Math.max(0, expiryTick - currentTick);
  const protectedMaxLoss = BigInt(protectedTicks) * breakdown.lossPerTick;
  const ticksToEmpty =
    army.troops.count === 0n
      ? 0
      : army.troops.count <= protectedMaxLoss
        ? Number((army.troops.count + breakdown.lossPerTick - 1n) / breakdown.lossPerTick)
        : protectedTicks +
          Number(
            (army.troops.count - protectedMaxLoss + breakdown.afterVitriolPerTick - 1n) / breakdown.afterVitriolPerTick,
          );
  const ticksInDay = Math.floor(day.end / interval) - currentTick;
  const emptiesAt = (currentTick + ticksToEmpty) * interval;
  return {
    lossPerTick: breakdown.lossPerTick,
    ticksToEmpty,
    ticksInDay,
    ticksLeft: Math.min(ticksToEmpty, ticksInDay),
    secondsLeft: Math.min(day.end, emptiesAt) - now,
    tickSeconds: interval,
    breakdown,
  };
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
