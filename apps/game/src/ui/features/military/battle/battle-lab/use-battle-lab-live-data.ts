import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import {
  ATTACK_FORECAST_MODELS,
  configManager,
  divideByPrecision,
  forecastAttack,
  getGuardsByStructure,
  StaminaManager,
  storedBiomeAt,
  type AttackForecast,
} from "@bibliothecadao/eternum";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import {
  BiomeType,
  DISPLAYED_SLOT_NUMBER_MAP,
  ID,
  RelicEffect,
  ResourcesIds,
  TroopTier,
  TroopType,
  type Troops,
} from "@bibliothecadao/types";
import { useMemo } from "react";

import { useAttackTargetData } from "../hooks/use-attack-target";
import { AttackTarget } from "../types";
import type { GuardOption, LiveSnapshot, WorkingArmy } from "./battle-lab.types";

const toResourceIds = (effects: RelicEffect[]): ResourcesIds[] =>
  effects.map((effect) => Number(effect.id)) as ResourcesIds[];

interface BattleLabLiveData {
  snapshot: LiveSnapshot | null;
  forecast: AttackForecast | undefined;
  target: AttackTarget | null;
  targetResources: Array<{ resourceId: number; amount: number }>;
  isLoading: boolean;
}

/**
 * Resolves the live on-chain combat picture (attacker army/guards, defender,
 * biome, relics) into a normalized {@link LiveSnapshot} for the Battle Lab.
 * In sim mode pass `enabled = false`; it then returns a null snapshot.
 */
export const useBattleLabLiveData = (
  enabled: boolean,
  attackerEntityId: ID,
  targetHex: { x: number; y: number },
  alt = false,
  guardSlot: number | null = null,
): BattleLabLiveData => {
  const facts = useNativeFacts(ATTACK_FORECAST_MODELS);
  const chainSecond = useCurrentDefaultTick();

  const { attackerRelicEffects, targetRelicEffects, target, targetResources, isLoading } = useAttackTargetData(
    attackerEntityId,
    targetHex,
    alt,
  );

  const attackerRelicIds = useMemo(() => toResourceIds(attackerRelicEffects), [attackerRelicEffects]);
  const targetRelicIds = useMemo(() => toResourceIds(targetRelicEffects), [targetRelicEffects]);

  const forecast = useMemo(() => {
    if (!enabled || !target) return undefined;
    const game_id = configManager.getActiveGameId();
    return forecastAttack(
      facts.store,
      { game_id, entity_id: attackerEntityId },
      { game_id, entity_id: target.id },
      chainSecond,
      { guardSlot: guardSlot ?? undefined },
    );
  }, [enabled, target, facts, attackerEntityId, chainSecond, guardSlot]);

  const snapshot = useMemo<LiveSnapshot | null>(() => {
    const sides = forecast?.sides;
    if (!sides) return null;
    const structure = facts.store.get("Structure", {
      game_id: configManager.getActiveGameId(),
      entity_id: attackerEntityId,
    });
    const guards = structure
      ? guardOptions(getGuardsByStructure(structure, facts.store), attackerRelicIds, chainSecond)
      : [];
    if (!guards) return null;
    const army = (troops: Troops, oaths: number, relics: ResourcesIds[]) =>
      workingArmy(troops, oaths, relics, chainSecond);
    return {
      biome:
        forecast.outcome === "fights"
          ? forecast.biome
          : (storedBiomeAt(facts.store, alt, targetHex.x, targetHex.y) ?? BiomeType.None),
      attackerType: structure ? "structure" : "army",
      attackerEntityId,
      guards,
      guardSlot: sides.attacker.guardSlot ?? null,
      armyAttacker: structure ? null : army(sides.attacker.troops, sides.attacker.oaths, attackerRelicIds),
      defender: sides.defender ? army(sides.defender.troops, sides.defender.oaths, targetRelicIds) : null,
      defenderAlt: alt,
    };
  }, [alt, facts, forecast, attackerEntityId, targetHex.x, targetHex.y, chainSecond, attackerRelicIds, targetRelicIds]);

  return { snapshot, forecast, target, targetResources, isLoading };
};

const guardOptions = (
  guards: ReturnType<typeof getGuardsByStructure>,
  relics: ResourcesIds[],
  chainSecond: number,
): GuardOption[] | undefined =>
  guards
    ?.filter((guard) => guard.troops.count > 0n)
    .toSorted((a, b) => a.slot - b.slot)
    .map((guard) => ({
      slot: guard.slot,
      label: `Slot ${DISPLAYED_SLOT_NUMBER_MAP[guard.slot as keyof typeof DISPLAYED_SLOT_NUMBER_MAP]}`,
      army: workingArmy(guard.troops, 0, relics, chainSecond),
    }));

const workingArmy = (troops: Troops, oaths: number, relics: ResourcesIds[], chainSecond: number): WorkingArmy => ({
  oaths,
  stamina: Number(StaminaManager.getStamina(troops, chainSecond).amount),
  maxStamina: StaminaManager.getMaxStamina(troops.category as TroopType, troops.tier as TroopTier, troops.staminaMax),
  troopCount: divideByPrecision(Number(troops.count)),
  troopType: troops.category as TroopType,
  tier: troops.tier as TroopTier,
  battle_cooldown_end: Number(troops.battle_cooldown_end),
  relics,
});
