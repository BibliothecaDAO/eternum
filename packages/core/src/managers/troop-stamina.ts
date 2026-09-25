import { TroopTier, TroopType, type Troops } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
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

/** A troop's stamina at a tick under one game's rules: the one stamina computation. */
export function staminaAt(troops: Troops, currentArmiesTick: number, rules: TroopStaminaRules) {
  const lastRefillTick = troops.stamina.updated_tick;
  const { staminaInitial, staminaMax } = troopStaminaLimits(
    rules,
    troops.category as TroopType,
    troops.tier as TroopTier,
  );
  const maximum = troops.staminaMax ?? staminaMax;

  if (lastRefillTick >= BigInt(currentArmiesTick)) {
    return structuredClone(troops.stamina);
  }

  if (lastRefillTick === 0n) {
    return {
      amount: BigInt(Math.min(staminaInitial, maximum)),
      updated_tick: BigInt(currentArmiesTick),
    };
  }

  const staminaPerTick = Number(rules.stamina_gain_per_tick);
  const boostPercent = Number(troops.boosts.incr_stamina_regen_percent_num);
  const boostStaminaPerTick = Math.floor((staminaPerTick * boostPercent) / 10_000);
  const ticksSinceLastRefill = currentArmiesTick - Number(lastRefillTick);
  const boostNumTicksPassed = Math.min(ticksSinceLastRefill, Number(troops.boosts.incr_stamina_regen_tick_count));
  const additionalStaminaBoost = boostNumTicksPassed * boostStaminaPerTick;
  const totalStaminaSinceLastTick = ticksSinceLastRefill * staminaPerTick + additionalStaminaBoost;

  return {
    amount: BigInt(Math.min(Number(troops.stamina.amount) + totalStaminaSinceLastTick, maximum)),
    updated_tick: BigInt(currentArmiesTick),
  };
}

/** The first tick at which the troop's stamina is full, or null when it never refills. */
export function fullAtTick(troops: Troops, currentArmiesTick: number, rules: TroopStaminaRules): number | null {
  const staminaMax =
    troops.staminaMax ?? troopStaminaLimits(rules, troops.category as TroopType, troops.tier as TroopTier).staminaMax;
  const isFull = (tick: number) => Number(staminaAt(troops, tick, rules).amount) >= staminaMax;
  if (isFull(currentArmiesTick)) return currentArmiesTick;
  const gain = Number(rules.stamina_gain_per_tick);
  if (gain <= 0) return null;
  // Stamina never falls between refills, so the first full tick is found by halving.
  let low = currentArmiesTick;
  let high = currentArmiesTick + Math.ceil(staminaMax / gain) + 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (isFull(middle)) high = middle;
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
    ...(rules && rules.epoch_seconds !== 0
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
  const progress = store.require("ArmyProgress", { game_id: explorer.game_id, explorer_id: explorer.explorer_id });
  const rules = store.require("SliceRules", { game_id: explorer.game_id });
  const base = troopStaminaLimits(rules.troop_stamina_config, explorer.troops.category, TroopTier.T1).staminaMax;
  return {
    ...explorer.troops,
    stamina: result.known.stamina,
    staminaMax: base + (progress.logistics - 1) * nativeRuleConstants.ATTRIBUTE_STAMINA,
    boosts: {
      ...explorer.troops.boosts,
      incr_damage_dealt_percent_num: (progress.battle - 1) * nativeRuleConstants.ATTRIBUTE_DAMAGE_PERCENT,
      incr_damage_dealt_end_tick: 0,
    },
  };
}

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
  home: { game_id: number; entity_id: number; allowedSlots: number },
): OpenArmySlot[] | undefined {
  const epoch = slotEpoch(store);
  if (epoch === undefined) return undefined;
  const open: OpenArmySlot[] = [];
  for (let slot = 0; slot < home.allowedSlots; slot += 1) {
    const result = store.requireOrAbsent("ArmySlot", {
      game_id: home.game_id,
      structure_id: home.entity_id,
      epoch,
      slot,
    });
    if (result.unknown) return undefined;
    if (!result.known) open.push({ slot, inherited: null });
    else if (result.known.explorer_id === 0) open.push({ slot, inherited: result.known.stamina });
  }
  return open;
}

/** The bar a new army of this troop starts on in the slot, at the tick, under the game's rules. */
export function musterStamina(
  slot: OpenArmySlot,
  troop: { category: TroopType; tier: TroopTier },
  currentArmiesTick: number,
  rules: TroopStaminaRules,
): { amount: number; max: number } {
  const { staminaInitial, staminaMax } = troopStaminaLimits(rules, troop.category, troop.tier);
  if (!slot.inherited) return { amount: Math.min(staminaInitial, staminaMax), max: staminaMax };
  const newArmy: Troops = { ...troop, count: 0n, stamina: slot.inherited, boosts: NO_BOOSTS, battle_cooldown_end: 0 };
  const bar = staminaAt(newArmy, currentArmiesTick, rules);
  return { amount: Number(bar.amount), max: staminaMax };
}

/** A newly mustered army carries no relic boosts yet. */
const NO_BOOSTS: Troops["boosts"] = {
  incr_damage_dealt_percent_num: 0,
  incr_damage_dealt_end_tick: 0,
  decr_damage_gotten_percent_num: 0,
  decr_damage_gotten_end_tick: 0,
  incr_stamina_regen_percent_num: 0,
  incr_stamina_regen_tick_count: 0,
  incr_explore_reward_percent_num: 0,
  incr_explore_reward_end_tick: 0,
};

/** Slots are keyed by the absolute epoch, known once the expedition scope and its clock are. */
const slotEpoch = (store: NativeFactStore): bigint | undefined => {
  const scope = store.subscriptionScope();
  if (!scope.known?.expedition || scope.known.expedition.absoluteEpoch < 0) return undefined;
  return BigInt(scope.known.expedition.absoluteEpoch);
};
