import type { NativeFactStore } from "../client/native-fact-store";
import { div, mul, ONE, unscaled, type Fixed } from "./cubit-fixed";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import {
  nativeOathConstants as oathRules,
  nativeRuleConstants,
  type NativeRows,
} from "../../../../contracts/l3/world-native/schema/client.gen";

export const oathColours = [
  { name: "Fight", mask: oathRules.RED, colour: "red" },
  { name: "Stamina", mask: oathRules.BLUE, colour: "blue" },
  { name: "Prize", mask: oathRules.GOLD, colour: "gold" },
] as const;

export function heldOaths(mask: number): number[] {
  return Array.from({ length: 16 }, (_, index) => index + 1).filter((id) => (mask & (1 << (id - 1))) !== 0);
}

export function oathCards(pick: number): number[] {
  if (pick === 0) return [];
  if (!Number.isInteger(pick) || pick < 0 || pick >= 4096) throw new Error("Invalid Oath pick");
  return oathColours.map(({ mask }, index) => {
    const id = ((pick >> (index * 4)) & 15) + 1;
    if ((mask & (1 << (id - 1))) === 0) throw new Error("Oath pick has the wrong colour");
    return id;
  });
}

export function chooseOath(
  progress: NativeRows["ArmyProgress"],
  expected: number,
  oath: number | null,
  replace: number | null,
) {
  if (expected === 0 || progress.oath_pick !== expected) throw new Error("Oath pick changed");
  let oaths = progress.oaths;
  const held = heldOaths(oaths);
  if (oath !== null) {
    if (!oathCards(expected).includes(oath) || held.includes(oath)) throw new Error("Oath not offered");
    if (held.length === progress.oath_slots) {
      if (replace === null || !held.includes(replace)) throw new Error("Choose an Oath to replace");
      oaths &= ~(1 << (replace - 1));
    } else if (replace !== null) throw new Error("Empty Oath slot available");
    oaths |= 1 << (oath - 1);
  } else if (replace !== null) throw new Error("Decline cannot replace");
  if (heldOaths(oaths).length > progress.oath_slots) throw new Error("Too many Oaths");
  return { ...progress, oaths, oath_pick: 0 };
}

export function oathPassStamina(current: number, maximum: number): number {
  return Math.min(current + oathRules.PASS_STAMINA, maximum);
}

export function oathWellStamina(oaths: number, maximum: number): number {
  const percent =
    (oaths & (1 << (oathRules.REFLECTION - 1))) !== 0
      ? oathRules.REFLECTION_WELL_PERCENT
      : nativeRuleConstants.WELL_REFILL_PERCENT;
  return Math.floor((maximum * percent) / 100);
}

export function oathDeepLossPerTick(oaths: number, base: bigint): bigint {
  return (oaths & (1 << (oathRules.VITRIOL - 1))) !== 0
    ? BigInt(oathRules.VITRIOL_LOSS_PER_TICK) * BigInt(RESOURCE_PRECISION)
    : base;
}

export function armyOaths(store: NativeFactStore, key: { game_id: number; explorer_id: bigint | number }): number {
  if (store.require("SliceRules", { game_id: key.game_id }).day_unit_seconds === 0) return 0;
  return store.require("ArmyProgress", key).oaths;
}

export function oathDamageMultiplier(attacker: number, defender: number, guarding: boolean): Fixed {
  let multiplier = ONE;
  if ((attacker & (1 << (oathRules.POWER - 1))) !== 0)
    multiplier = mul(multiplier, div(unscaled(100 + oathRules.POWER_DAMAGE_PERCENT), unscaled(100)));
  if ((defender & (1 << (oathRules.GIANTS - 1))) !== 0)
    multiplier = mul(multiplier, div(unscaled(100 - oathRules.GIANTS_REDUCTION_PERCENT), unscaled(100)));
  if (guarding && (defender & (1 << (oathRules.PROTECTION - 1))) !== 0)
    multiplier = mul(multiplier, div(unscaled(100 - oathRules.PROTECTION_REDUCTION_PERCENT), unscaled(100)));
  return multiplier;
}
