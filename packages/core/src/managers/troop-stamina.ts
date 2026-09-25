import { TroopTier, TroopType, type Troops } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
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

  if (lastRefillTick >= BigInt(currentArmiesTick)) {
    return structuredClone(troops.stamina);
  }

  if (lastRefillTick === 0n) {
    return {
      amount: BigInt(Math.min(staminaInitial, staminaMax)),
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
    amount: BigInt(Math.min(Number(troops.stamina.amount) + totalStaminaSinceLastTick, staminaMax)),
    updated_tick: BigInt(currentArmiesTick),
  };
}

/** The first tick at which the troop's stamina is full, or null when it never refills. */
export function fullAtTick(troops: Troops, currentArmiesTick: number, rules: TroopStaminaRules): number | null {
  const { staminaMax } = troopStaminaLimits(rules, troops.category as TroopType, troops.tier as TroopTier);
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
export function inlineTroops(troops: NativeRows["ExplorerTroops"]["troops"]): Troops {
  if (!("Inline" in troops.stamina)) throw new Error("Army slot requires its home and current epoch");
  return { ...troops, stamina: troops.stamina.Inline };
}

/** The sole explorer bar resolver; an occupied slot must be present and name this explorer. */
export function resolveExplorerTroops(
  store: NativeFactStore,
  explorer: NativeRows["ExplorerTroops"],
): Troops | undefined {
  const source = explorer.troops.stamina;
  if ("Inline" in source) return inlineTroops(explorer.troops);
  const scope = store.subscriptionScope();
  if (!scope.known?.expedition || scope.known.expedition.absoluteEpoch < 0) return undefined;
  const result = store.requireOrAbsent("ArmySlot", {
    game_id: explorer.game_id,
    structure_id: explorer.owner,
    epoch: BigInt(scope.known.expedition.absoluteEpoch),
    slot: source.Slot,
  });
  if (result.unknown) return undefined;
  if (!result.known) throw new Error("Missing occupied army slot: unused");
  if (result.known.explorer_id !== explorer.explorer_id) throw new Error("Army slot occupant mismatch");
  return { ...explorer.troops, stamina: result.known.stamina };
}
