import { useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";
import {
  Biome,
  divideByPrecision,
  getEntityIdFromKeys,
  getGuardsByStructure,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  DISPLAYED_SLOT_NUMBER_MAP,
  ID,
  RelicEffectWithEndTick,
  ResourcesIds,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

import { getGuardStaminaSnapshot } from "../../utils/guard-stamina";
import { useAttackTargetData } from "../hooks/use-attack-target";
import { AttackTarget } from "../types";
import type { GuardOption, LiveSnapshot, WorkingArmy } from "./battle-lab.types";
import { gameEntityKey } from "@/dojo/game-scope";

const toResourceIds = (effects: RelicEffectWithEndTick[]): ResourcesIds[] =>
  effects.map((effect) => Number(effect.id)) as ResourcesIds[];

interface BattleLabLiveData {
  snapshot: LiveSnapshot | null;
  target: AttackTarget | null;
  targetResources: Array<{ resourceId: number; amount: number }>;
  attackerRelicEffects: RelicEffectWithEndTick[];
  targetRelicEffects: RelicEffectWithEndTick[];
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
): BattleLabLiveData => {
  const {
    setup: {
      components,
      components: { Structure, ExplorerTroops },
    },
  } = useDojo();
  const currentArmiesTick = useCurrentArmiesTick();

  const { attackerRelicEffects, targetRelicEffects, target, targetResources, isLoading } = useAttackTargetData(
    attackerEntityId,
    targetHex,
  );

  const attackerRelicIds = useMemo(() => toResourceIds(attackerRelicEffects), [attackerRelicEffects]);
  const targetRelicIds = useMemo(() => toResourceIds(targetRelicEffects), [targetRelicEffects]);

  const snapshot = useMemo<LiveSnapshot | null>(() => {
    if (!enabled) return null;

    const structure = getComponentValue(Structure, gameEntityKey([BigInt(attackerEntityId)]));
    const biome = Biome.getBiome(targetHex.x, targetHex.y);

    // Attacker: structure (guard slots) vs explorer army.
    let attackerType: "structure" | "army" = "army";
    let guards: GuardOption[] = [];
    let armyAttacker: WorkingArmy | null = null;

    if (structure) {
      attackerType = "structure";
      guards = getGuardsByStructure(structure)
        .filter((guard) => guard.troops.count > 0n)
        .toSorted((a, b) => a.slot - b.slot)
        .map((guard) => {
          const staminaSnapshot = getGuardStaminaSnapshot(guard.troops, currentArmiesTick);
          const army: WorkingArmy = {
            stamina: Math.floor(staminaSnapshot?.current ?? Number(guard.troops.stamina?.amount ?? 0n)),
            troopCount: divideByPrecision(Number(guard.troops.count)),
            troopType: guard.troops.category as TroopType,
            tier: guard.troops.tier as TroopTier,
            battle_cooldown_end: Number(guard.troops.battle_cooldown_end ?? 0),
            relics: attackerRelicIds,
          };
          const slotNumber = DISPLAYED_SLOT_NUMBER_MAP[guard.slot as keyof typeof DISPLAYED_SLOT_NUMBER_MAP];
          return { slot: guard.slot, label: `Slot ${slotNumber}`, army };
        });
    } else {
      const army = getComponentValue(ExplorerTroops, gameEntityKey([BigInt(attackerEntityId)]));
      if (army) {
        const stamina = new StaminaManager(components, attackerEntityId).getStamina(currentArmiesTick).amount;
        armyAttacker = {
          stamina: Number(stamina),
          troopCount: divideByPrecision(Number(army.troops.count)),
          troopType: army.troops.category as TroopType,
          tier: army.troops.tier as TroopTier,
          battle_cooldown_end: Number(army.troops.battle_cooldown_end ?? 0),
          relics: attackerRelicIds,
        };
      }
    }

    // Defender: first guard / troop on the target tile (null = claim).
    const defenderTroop = target?.info?.[0] ?? null;
    const defender: WorkingArmy | null = defenderTroop
      ? {
          stamina: Number(defenderTroop.stamina.amount),
          troopCount: divideByPrecision(Number(defenderTroop.count)),
          troopType: defenderTroop.category as TroopType,
          tier: defenderTroop.tier as TroopTier,
          battle_cooldown_end: Number(defenderTroop.battle_cooldown_end ?? 0),
          relics: targetRelicIds,
        }
      : null;

    const totalDefenders = (target?.info ?? []).reduce(
      (total, troop) => total + divideByPrecision(Number(troop.count || 0n)),
      0,
    );

    return {
      biome,
      attackerType,
      attackerEntityId,
      guards,
      armyAttacker,
      defender,
      totalDefenders,
      hasTarget: Boolean(target),
    };
  }, [
    enabled,
    Structure,
    ExplorerTroops,
    components,
    attackerEntityId,
    targetHex.x,
    targetHex.y,
    currentArmiesTick,
    target,
    attackerRelicIds,
    targetRelicIds,
  ]);

  return { snapshot, target, targetResources, attackerRelicEffects, targetRelicEffects, isLoading };
};
