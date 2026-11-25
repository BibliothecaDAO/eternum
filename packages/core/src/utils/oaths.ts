import type { NativeFactStore } from "../client/native-fact-store";
import { div, mul, ONE, unscaled, type Fixed } from "./cubit-fixed";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeOathConstants as oathRules } from "../../../../contracts/l3/world-native/schema/balance.gen";

export function oathBit(oath: number): number {
  return 1 << (oath - 1);
}

export function heldOaths(mask: number): number[] {
  return Array.from({ length: 16 }, (_, index) => index + 1).filter((id) => holdsOath(mask, id));
}

export function oathCards(pick: number): number[] {
  if (pick === 0) return [];
  if (!Number.isInteger(pick) || pick < 0 || pick >= oathRules.REROLLED * 2) throw new Error("Invalid Oath pick");
  return [...new Set([0, 1, 2].map((index) => oathCard(pick, index)))];
}

const oathCard = (pick: number, index: number) => ((pick >> (index * 4)) & 15) + 1;

export function oathRerollIndex(pick: number, oaths: number, oath: number): number | null {
  const index = [0, 1, 2].find((at) => oathCard(pick, at) === oath);
  if (index === undefined) throw new Error("Oath not offered");
  const left = 16 - heldOaths(oaths).length - oathCards(pick).length;
  return left > 0 && pick < oathRules.REROLLED ? index : null;
}

export function rerollOath(progress: NativeRows["ArmyProgress"], expected: number, index: number, oath: number) {
  if (expected === 0 || progress.oath_pick !== expected) throw new Error("Oath pick changed");
  if (oathRerollIndex(expected, progress.oaths, oathCard(expected, index)) !== index)
    throw new Error("Card not rerollable");
  if (holdsOath(progress.oaths, oath) || oathCards(expected).includes(oath)) throw new Error("Oath not drawable");
  const scale = 1 << (index * 4);
  const pick = expected - (oathCard(expected, index) - 1) * scale + (oath - 1) * scale + oathRules.REROLLED;
  return { ...progress, oath_pick: pick };
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
      oaths &= ~oathBit(replace);
    } else if (replace !== null) throw new Error("Empty Oath slot available");
    oaths |= oathBit(oath);
  } else if (replace !== null) throw new Error("Decline cannot replace");
  if (heldOaths(oaths).length > progress.oath_slots) throw new Error("Too many Oaths");
  return { ...progress, oaths, oath_pick: 0 };
}

export function oathPassStamina(current: number, maximum: number): number {
  return Math.min(current + oathRules.PASS_STAMINA, maximum);
}

export function oathDeepLossPerTick(oaths: number, base: bigint): bigint {
  return holdsOath(oaths, oathRules.VITRIOL)
    ? BigInt(oathRules.VITRIOL_LOSS_PER_TICK) * BigInt(RESOURCE_PRECISION)
    : base;
}

export function oathSkillMultiplier(oaths: number, barAfterCost: bigint): Fixed {
  return holdsOath(oaths, oathRules.SKILL) && barAfterCost < BigInt(oathRules.SKILL_BELOW_STAMINA)
    ? div(unscaled(100 + oathRules.SKILL_DAMAGE_PERCENT), unscaled(100))
    : ONE;
}

export function oathTwinDamage(oaths: number, companionDamage: bigint): bigint {
  if (!holdsOath(oaths, oathRules.TWINS)) return 0n;
  const precision = BigInt(RESOURCE_PRECISION);
  return ((companionDamage * BigInt(oathRules.TWINS_DAMAGE_PERCENT)) / 100n / precision) * precision;
}

export function oathFuryRefund(oaths: number, cost: number): number {
  return holdsOath(oaths, oathRules.FURY) ? Math.floor((cost * oathRules.FURY_REFUND_PERCENT) / 100) : 0;
}

export function oathAttackStamina(oaths: number, base: number): number {
  return holdsOath(oaths, oathRules.ANGER) ? Math.min(base, oathRules.ANGER_ATTACK_STAMINA) : base;
}

export function oathStaminaBonus(oaths: number): number {
  return holdsOath(oaths, oathRules.TITANS) ? oathRules.TITANS_STAMINA : 0;
}

export function oathRegenBps(oaths: number): number {
  return holdsOath(oaths, oathRules.ENLIGHTENMENT) ? oathRules.ENLIGHTENMENT_REGEN_BPS : 10_000;
}

export function oathExploreStamina(oaths: number, base: number): number {
  return holdsOath(oaths, oathRules.FOX)
    ? Math.floor((base * (100 - oathRules.FOX_REVEAL_DISCOUNT_PERCENT)) / 100)
    : base;
}

export function oathRevealPay(oaths: number, amount: bigint): bigint {
  return holdsOath(oaths, oathRules.BRILLIANCE) ? (amount * BigInt(oathRules.BRILLIANCE_PAY_PERCENT)) / 100n : amount;
}

export function isCleanWin(before: bigint, after: bigint): boolean {
  return (before - after) * 100n < before * BigInt(oathRules.PERFECTION_LOSS_PERCENT);
}

export function oathSitePay(oaths: number, amount: bigint, clean: boolean): bigint {
  const raged = holdsOath(oaths, oathRules.RAGE) ? (amount * BigInt(oathRules.RAGE_PAY_PERCENT)) / 100n : amount;
  return clean && holdsOath(oaths, oathRules.PERFECTION)
    ? (raged * BigInt(oathRules.PERFECTION_PAY_PERCENT)) / 100n
    : raged;
}

export function armyOaths(store: NativeFactStore, key: { game_id: number; explorer_id: bigint | number }): number {
  if (store.require("SliceRules", { game_id: key.game_id }).day_unit_seconds === 0) return 0;
  return store.require("ArmyProgress", key).oaths;
}

export function oathDamageMultiplier(attacker: number, defender: number, guarding: boolean): Fixed {
  let multiplier = ONE;
  if (holdsOath(attacker, oathRules.POWER))
    multiplier = mul(multiplier, div(unscaled(100 + oathRules.POWER_DAMAGE_PERCENT), unscaled(100)));
  if (holdsOath(defender, oathRules.GIANTS))
    multiplier = mul(multiplier, div(unscaled(100 - oathRules.GIANTS_REDUCTION_PERCENT), unscaled(100)));
  if (guarding && holdsOath(defender, oathRules.PROTECTION))
    multiplier = mul(multiplier, div(unscaled(100 - oathRules.PROTECTION_REDUCTION_PERCENT), unscaled(100)));
  return multiplier;
}

export function holdsOath(oaths: number, oath: number): boolean {
  return (oaths & oathBit(oath)) !== 0;
}
