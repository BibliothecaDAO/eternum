import { TroopTier, TroopType, type Troops } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { battleBonusBps, logisticsStamina } from "../utils/attribute-tiers";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

/** One game's stamina rules, exactly as its SliceRules carries them. */
export type TroopStaminaRules = NativeRows["SliceRules"]["troop_stamina_config"];

/** A troop's starting and maximum stamina under one game's rules. */
export const troopStaminaLimits = (rules: TroopStaminaRules, troopType: TroopType, troopTier: TroopTier) => {
  const maximum = {
    [TroopType.Knight]: rules.stamina_knight_max,
    [TroopType.Crossbowman]: rules.stamina_crossbowman_max,
    [TroopType.Paladin]: rules.stamina_paladin_max,
  }[troopType];
  const tier = [TroopTier.T1, TroopTier.T2, TroopTier.T3].indexOf(troopTier);
  if (maximum === undefined || tier < 0) throw new Error("Unknown troop category or tier");
  return { staminaInitial: Number(rules.stamina_initial), staminaMax: Number(maximum) + tier * 20 };
};

/** Below the cap, any partition of the same seconds yields the same gain and remainder, including boost expiry. */
export function staminaAt(troops: Troops, timestamp: number, rules: TroopStaminaRules, tickSeconds: number) {
  const bar = troops.stamina;
  const { staminaInitial, staminaMax } = troopStaminaLimits(rules, troops.category, troops.tier);
  const maximum = BigInt(troops.staminaMax ?? staminaMax);
  const secondsLeft = troops.boosts.incr_stamina_regen_seconds_left;
  const now = Math.max(bar.settled_at, Math.floor(timestamp));
  const elapsed = bar.settled_at === 0 ? 0 : now - bar.settled_at;
  const boosted = Math.min(elapsed, secondsLeft);
  const denominator = BigInt(tickSeconds) * 10_000n;
  const numerator =
    BigInt(bar.remainder) +
    BigInt(rules.stamina_gain_per_tick) *
      (BigInt(elapsed) * 10_000n + BigInt(boosted) * BigInt(troops.boosts.incr_stamina_regen_percent_num));
  const total = bar.settled_at === 0 ? BigInt(staminaInitial) : bar.amount + numerator / denominator;
  return {
    amount: total >= maximum ? maximum : total,
    settled_at: now,
    remainder: total >= maximum || bar.settled_at === 0 ? 0 : Number(numerator % denominator),
    boostSecondsLeft: secondsLeft - boosted,
  };
}

/** The first second an army can afford a cost, or null if it exceeds the cap or regeneration is disabled. */
export function affordableAt(
  troops: Troops,
  timestamp: number,
  rules: TroopStaminaRules,
  tickSeconds: number,
  cost: number,
): number | null {
  const maximum = troops.staminaMax ?? troopStaminaLimits(rules, troops.category, troops.tier).staminaMax;
  const now = Math.floor(timestamp);
  const canAfford = (second: number) => staminaAt(troops, second, rules, tickSeconds).amount >= BigInt(cost);
  if (canAfford(now)) return now;
  const gain = Number(rules.stamina_gain_per_tick);
  if (cost > maximum || gain <= 0) return null;
  let low = now;
  let high = Math.max(now, troops.stamina.settled_at) + Math.ceil((cost * tickSeconds) / gain) + 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (canAfford(middle)) high = middle;
    else low = middle;
  }
  return high;
}

/** Guard and non-expedition arithmetic accepts only the inline variant. */
export function inlineTroops(troops: NativeRows["ExplorerTroops"]["troops"], rules?: NativeRows["SliceRules"]): Troops {
  if (!("Inline" in troops.stamina)) throw new Error("Army slot requires its home and current epoch");
  return {
    ...troops,
    stamina: troops.stamina.Inline,
    ...(rules && rules.day_unit_seconds !== 0
      ? {
          staminaMax: troopStaminaLimits(rules.troop_stamina_config, troops.category, TroopTier.T1).staminaMax,
        }
      : {}),
  };
}

/** The sole explorer bar resolver; an occupied slot must be present and name this explorer. */
export function resolveExplorerTroops(
  store: NativeFactStore,
  explorer: NativeRows["ExplorerTroops"],
): Troops | undefined {
  const source = explorer.troops.stamina;
  if ("Inline" in source) return inlineTroops(explorer.troops);
  const epoch = slotEpoch(store);
  if (epoch === undefined) return undefined;
  const result = store.requireOrAbsent("ArmySlot", {
    game_id: explorer.game_id,
    structure_id: explorer.owner,
    epoch,
    slot: source.Slot,
  });
  if (result.unknown) return undefined;
  if (!result.known) throw new Error("Missing occupied army slot: unused");
  if (result.known.explorer_id !== explorer.explorer_id) throw new Error("Army slot occupant mismatch");
  const progress = store.get("ArmyProgress", { game_id: explorer.game_id, explorer_id: explorer.explorer_id });
  const rules = store.get("SliceRules", { game_id: explorer.game_id });
  if (!progress || !rules) return undefined;
  const base = troopStaminaLimits(rules.troop_stamina_config, explorer.troops.category, TroopTier.T1).staminaMax;
  return {
    ...explorer.troops,
    stamina: result.known.stamina,
    staminaMax: base + logisticsStamina(progress.logistics),
    boosts: {
      ...explorer.troops.boosts,
      incr_damage_dealt_percent_num: battleBonusBps(progress.battle),
      incr_damage_dealt_end_at: 0,
    },
  };
}

/**
 * An army's number among its realm's armies, the same wherever the army is shown (its dock card, its map plate): its
 * army slot, counted from one. Undefined for an army that keeps its own bar, in a game without slots.
 */
export const armyNumber = (explorer: NativeRows["ExplorerTroops"]): number | undefined =>
  "Slot" in explorer.troops.stamina ? explorer.troops.stamina.Slot + 1 : undefined;

/** A slot a home can muster into today, with the bar the army starts on: fresh, or the bar its last army left. */
export interface OpenArmySlot {
  slot: number;
  inherited: Troops["stamina"] | null;
}

/**
 * A home's vacant army slots today, lowest first, as the contract fills them: a slot never used today starts a fresh
 * bar, and a slot whose army died or was removed hands its bar on, so replacing a tired army mints no stamina.
 * Undefined until every one of the home's slots is known.
 */
export function openArmySlots(
  store: NativeFactStore,
  home: { game_id: number; entity_id: number | bigint; allowedSlots: number },
): OpenArmySlot[] | undefined {
  const epoch = slotEpoch(store);
  if (epoch === undefined) return undefined;
  if (typeof home.entity_id === "number" && !Number.isSafeInteger(home.entity_id))
    throw new Error("Home id must be a safe integer or bigint");
  const open: OpenArmySlot[] = [];
  for (let slot = 0; slot < home.allowedSlots; slot += 1) {
    const result = store.requireOrAbsent("ArmySlot", {
      game_id: home.game_id,
      structure_id: BigInt(home.entity_id),
      epoch,
      slot,
    });
    if (result.unknown) return undefined;
    if (!result.known) open.push({ slot, inherited: null });
    else if (result.known.explorer_id === 0n) open.push({ slot, inherited: result.known.stamina });
  }
  return open;
}

/**
 * The bar a new army of this troop starts on in the slot, at the second, under the game's rules, when its realm has
 * trained Logistics to `trainedLogistics` tiers above common (the Supply yard's row).
 */
export function musterStamina(
  slot: OpenArmySlot,
  troop: { category: TroopType; tier: TroopTier },
  timestamp: number,
  rules: TroopStaminaRules,
  trainedLogistics: number,
  tickSeconds: number,
): { amount: number; max: number } {
  // A new slot occupant starts at its realm's trained Logistics, regardless of its troop tier.
  const staminaMax =
    troopStaminaLimits(rules, troop.category, TroopTier.T1).staminaMax + logisticsStamina(trainedLogistics + 1);
  // A slot's first army of the day starts full at its own maximum.
  if (!slot.inherited) return { amount: staminaMax, max: staminaMax };
  const newArmy: Troops = {
    ...troop,
    count: 0n,
    stamina: { ...slot.inherited, amount: BigInt(Math.min(Number(slot.inherited.amount), staminaMax)) },
    staminaMax,
    boosts: NO_BOOSTS,
    battle_cooldown_end: 0,
  };
  const bar = staminaAt(newArmy, timestamp, rules, tickSeconds);
  return { amount: Number(bar.amount), max: staminaMax };
}

/** A newly mustered army carries no relic boosts yet. */
const NO_BOOSTS: Troops["boosts"] = {
  incr_damage_dealt_percent_num: 0,
  incr_damage_dealt_end_at: 0,
  decr_damage_gotten_percent_num: 0,
  decr_damage_gotten_end_at: 0,
  incr_stamina_regen_percent_num: 0,
  incr_stamina_regen_seconds_left: 0,
  incr_explore_reward_percent_num: 0,
  incr_explore_reward_end_at: 0,
};

/** Slots are keyed by the season day, known once the expedition scope and its clock are. */
const slotEpoch = (store: NativeFactStore): bigint | undefined => {
  const scope = store.subscriptionScope();
  if (!scope.known?.expedition || scope.known.expedition.day < 0) return undefined;
  return BigInt(scope.known.expedition.day);
};
