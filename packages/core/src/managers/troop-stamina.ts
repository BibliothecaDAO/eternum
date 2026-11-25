export { exploreStaminaCost } from "../utils/explore-stamina";
import { readStaminaEffects } from "../client/views/stamina";
import { expeditionDepth, readExpeditionRules } from "../utils/expeditions";
export { STAMINA_MODELS } from "../client/views/stamina";
import { currentArmy } from "../utils/deep";
import { entityMapOccupancy } from "../utils/tile";
import { troopTierIndex, TroopTier, TroopType, type Troops, type StaminaEffects } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { armyRelicBonus, staminaRegenBoost } from "../utils/army-relics";
import { logisticsStamina } from "../utils/attribute-tiers";
import { oathStaminaBonus } from "../utils/oaths";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

/** One game's stamina rules, exactly as its SliceRules carries them. */
export type TroopStaminaRules = NativeRows["SliceRules"]["troop_stamina_config"];

/** A troop's starting and maximum stamina under one game's rules. */
export const troopStaminaLimits = (rules: TroopStaminaRules, troopType: TroopType, troopTier: TroopTier) => {
  const maxima: Record<TroopType, TroopStaminaRules["stamina_knight_max"]> = {
    [TroopType.Knight]: rules.stamina_knight_max,
    [TroopType.Crossbowman]: rules.stamina_crossbowman_max,
    [TroopType.Paladin]: rules.stamina_paladin_max,
  };
  const maximum = maxima[troopType];
  const tier = troopTierIndex(troopTier);
  if (maximum === undefined) throw new Error("Unknown troop category");
  return { staminaInitial: Number(rules.stamina_initial), staminaMax: Number(maximum) + tier * 20 };
};

export const armyStaminaMax = (
  rules: TroopStaminaRules,
  category: TroopType,
  progress: Pick<NativeRows["ArmyProgress"], "logistics" | "oaths">,
): number => {
  const base = troopStaminaLimits(rules, category, TroopTier.T1).staminaMax;
  return base + logisticsStamina(base, progress.logistics) + oathStaminaBonus(progress.oaths);
};

/** Historical effect windows and boost expiry share one fractional stamina scale. */
export function staminaAt(troops: Troops, timestamp: number, rules: TroopStaminaRules, tickSeconds: number) {
  const { staminaInitial, staminaMax } = troopStaminaLimits(rules, troops.category, troops.tier);
  const maximum = BigInt(troops.staminaMax ?? staminaMax);
  const until = Math.max(
    troops.stamina.settled_at,
    Math.min(Math.floor(timestamp), troops.staminaEffects?.until ?? Infinity),
  );
  let bar = { ...troops.stamina, boostSecondsLeft: troops.boosts.incr_stamina_regen_seconds_left };
  const settle = (end: number, rateBps: number) => {
    bar = refillStamina(
      bar,
      troops.boosts.incr_stamina_regen_percent_num,
      Math.max(bar.settled_at, end),
      maximum,
      staminaInitial,
      rules.stamina_gain_per_tick,
      tickSeconds,
      rateBps,
    );
  };
  if (bar.settled_at !== 0) {
    for (const window of troops.staminaEffects?.windows ?? []) {
      const start = Math.max(bar.settled_at, window.start);
      const end = Math.min(until, window.end);
      if (start >= end) continue;
      settle(start, 10_000);
      settle(end, window.rateBps);
    }
  }
  settle(until, 10_000);
  return bar;
}

function refillStamina(
  bar: Troops["stamina"] & { boostSecondsLeft: number },
  boostBps: number,
  now: number,
  maximum: bigint,
  initial: number,
  gain: number,
  tickSeconds: number,
  rateBps: number,
) {
  const elapsed = bar.settled_at === 0 ? 0 : now - bar.settled_at;
  const boosted = Math.min(elapsed, bar.boostSecondsLeft);
  const denominator = BigInt(tickSeconds) * 10_000n;
  const rate = BigInt(rateBps);
  const boostedRate = (rate * BigInt(10_000 + boostBps)) / 10_000n;
  const numerator =
    BigInt(bar.remainder) + BigInt(gain) * (BigInt(elapsed - boosted) * rate + BigInt(boosted) * boostedRate);
  const total = bar.settled_at === 0 ? BigInt(initial) : bar.amount + numerator / denominator;
  return {
    amount: total >= maximum ? maximum : total,
    settled_at: now,
    remainder: total >= maximum || bar.settled_at === 0 ? 0 : Number(numerator % denominator),
    boostSecondsLeft: bar.boostSecondsLeft - boosted,
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
  if (troops.staminaEffects && now >= troops.staminaEffects.until) return null;
  const canAfford = (second: number) => staminaAt(troops, second, rules, tickSeconds).amount >= BigInt(cost);
  if (canAfford(now)) return now;
  const gain = Number(rules.stamina_gain_per_tick);
  if (cost > maximum || gain <= 0) return null;
  let low = now;
  let high =
    troops.staminaEffects && Number.isFinite(troops.staminaEffects.until)
      ? troops.staminaEffects.until - 1
      : Math.max(now, troops.stamina.settled_at) + Math.ceil((cost * tickSeconds) / gain) + 1;
  if (!canAfford(high)) return null;
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

/** Combat reads the same slot and skill state, plus active effects at the execution second. */
export function resolveExplorerCombatTroops(
  store: NativeFactStore,
  explorer: NativeRows["ExplorerTroops"],
  timestamp: number,
): Troops | undefined {
  const troops = resolveExplorerTroops(store, explorer, timestamp);
  if (!troops) return undefined;
  const blade = armyRelicBonus(store, explorer, "Blade", timestamp);
  const ward = armyRelicBonus(store, explorer, "Ward", timestamp);
  if (blade === undefined || ward === undefined) return undefined;
  return {
    ...troops,
    boosts: {
      ...troops.boosts,
      incr_damage_dealt_percent_num: troops.boosts.incr_damage_dealt_percent_num + blade,
      decr_damage_gotten_percent_num: troops.boosts.decr_damage_gotten_percent_num + ward,
    },
  };
}

/** The sole explorer bar resolver; an occupied slot must be present and name this explorer. */
export function resolveExplorerTroops(
  store: NativeFactStore,
  explorer: NativeRows["ExplorerTroops"],
  timestamp?: number,
): Troops | undefined {
  explorer = currentArmy(store, explorer, timestamp);
  const source = explorer.troops.stamina;
  if ("Inline" in source) return inlineTroops(explorer.troops);
  const day = store.get("ArmyDay", { game_id: explorer.game_id, explorer_id: explorer.explorer_id });
  if (!day) return undefined;
  const epoch = day.day;
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
  const calendar = readExpeditionRules(store, explorer.game_id);
  const position = entityMapOccupancy(store, explorer.game_id, explorer.explorer_id);
  if (calendar && !position) return undefined;
  const effects = readStaminaEffects(
    store,
    explorer.game_id,
    explorer.owner,
    epoch,
    result.known.stamina.settled_at,
    calendar && position ? expeditionDepth(calendar, { y: position.row }) : 0,
    progress.oaths,
  );
  if (!effects.known) return undefined;
  const regen = staminaRegenBoost(store, explorer, result.known.stamina.settled_at);
  if (!regen) return undefined;
  return {
    ...explorer.troops,
    boosts:
      regen.incr_stamina_regen_seconds_left > 0 ? { ...explorer.troops.boosts, ...regen } : explorer.troops.boosts,
    stamina: result.known.stamina,
    staminaMax: armyStaminaMax(rules.troop_stamina_config, explorer.troops.category, progress),
    staminaEffects: effects.known,
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
  effects?: StaminaEffects;
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
    else if (result.known.explorer_id === 0n) {
      const effects = readStaminaEffects(
        store,
        home.game_id,
        home.entity_id,
        epoch,
        result.known.stamina.settled_at,
        0,
        0,
      );
      if (!effects.known) return undefined;
      open.push({ slot, inherited: result.known.stamina, effects: effects.known });
    }
  }
  return open;
}

/**
 * The bar a new army of this troop starts on, at the second, under the game's rules: the one rule both modes read
 * before raising one. In a game with army slots (Frontier), in the slot, when its realm has trained Logistics to
 * `trainedLogistics` rank (the Supply yard's row). In a game without (`slot` null: Blitz, Eternum), the
 * game's initial stamina under its own troop and tier's maximum, as the contract grants a new army (live-qa-night-2
 * B-2: a Blitz army started at 30/120 and nothing said so).
 */
export function musterStamina(
  slot: OpenArmySlot | null,
  troop: { category: TroopType; tier: TroopTier },
  timestamp: number,
  rules: TroopStaminaRules,
  trainedLogistics: number,
  tickSeconds: number,
): { amount: number; max: number } {
  if (slot === null) {
    const { staminaInitial, staminaMax } = troopStaminaLimits(rules, troop.category, troop.tier);
    return { amount: Math.min(staminaInitial, staminaMax), max: staminaMax };
  }
  // A new slot occupant starts at its realm's trained Logistics, regardless of its troop tier.
  const base = troopStaminaLimits(rules, troop.category, TroopTier.T1).staminaMax;
  const staminaMax = base + logisticsStamina(base, trainedLogistics);
  // A slot's first army of the day starts full at its own maximum.
  if (!slot.inherited) return { amount: staminaMax, max: staminaMax };
  const newArmy: Troops = {
    ...troop,
    count: 0n,
    stamina: { ...slot.inherited, amount: BigInt(Math.min(Number(slot.inherited.amount), staminaMax)) },
    staminaMax,
    ...(slot.effects ? { staminaEffects: slot.effects } : {}),
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
