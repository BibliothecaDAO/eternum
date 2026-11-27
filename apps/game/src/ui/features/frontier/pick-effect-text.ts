import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import {
  configManager,
  oathAttackStamina,
  oathBit,
  oathDeepLossPerTick,
  oathRegenBonusPerHour,
} from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { armyStaminaMax, exploreStaminaCost } from "@bibliothecadao/eternum/troop-stamina";
import { RESOURCE_PRECISION, TroopType } from "@bibliothecadao/types";

import type { PickEffectBase } from "./pick-effect-format";
import { combatMarkOf } from "./sites/combat-mark";

const PICK_EFFECT_MODELS = ["SliceRules", "DeepRules", "ExplorerTroops", "ArmyProgress"] as const;

type ArmyBasis = { category: TroopType; logistics: number; oaths: number };

const RULES_ARMY: ArmyBasis = { category: TroopType.Knight, logistics: 0, oaths: 0 };

export function readPickEffectBase(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  army: ArmyBasis = RULES_ARMY,
): PickEffectBase {
  const slice = store.get("SliceRules", { game_id: gameId });
  const deep = store.get("DeepRules", { game_id: gameId });
  const tickSeconds = slice ? Math.max(1, Number(slice.tick_config.armies_tick_in_seconds)) : undefined;
  return {
    combatIcon: combatMarkOf(army.category).icon,
    attackStamina: slice && oathAttackStamina(army.oaths, slice.troop_stamina_config.stamina_attack_req),
    revealStamina: slice && exploreStaminaCost(slice, army.category, army.oaths),
    maxStamina: slice && armyStaminaMax(slice.troop_stamina_config, army.category, army),
    staminaPerSecond:
      slice && tickSeconds !== undefined
        ? slice.troop_stamina_config.stamina_gain_per_tick / tickSeconds + oathRegenBonusPerHour(army.oaths) / 3600
        : undefined,
    deepLossPerTick: deep
      ? Number(oathDeepLossPerTick(army.oaths, BigInt(deep.loss_per_tick))) / RESOURCE_PRECISION
      : undefined,
    deepBaseLossPerTick: deep ? Number(deep.loss_per_tick) / RESOURCE_PRECISION : undefined,
    oaths: army.oaths,
  };
}

function readArmyBasis(store: Pick<NativeFactStore, "get">, gameId: number, explorerId: number): ArmyBasis | undefined {
  const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: explorerId });
  if (!army) return undefined;
  const progress = store.get("ArmyProgress", { game_id: gameId, explorer_id: explorerId });
  return { category: army.troops.category, logistics: progress?.logistics ?? 0, oaths: progress?.oaths ?? 0 };
}

export function usePickEffectBase(explorerId: number | null): (without?: number) => PickEffectBase {
  const { store } = useNativeFacts(PICK_EFFECT_MODELS);
  const gameId = configManager.getActiveGameId();
  const army = explorerId === null ? undefined : readArmyBasis(store, gameId, explorerId);
  return (without) =>
    readPickEffectBase(
      store,
      gameId,
      army && without !== undefined ? { ...army, oaths: army.oaths & ~oathBit(without) } : army,
    );
}
