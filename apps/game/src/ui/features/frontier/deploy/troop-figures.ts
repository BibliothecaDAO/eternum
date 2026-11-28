import { exploreStaminaOf } from "@/lib/army-stamina/explore-stamina";
import type { TroopFigures, TroopTraits } from "@/ui/design-system/kit/words";
import { armyOaths, dealsLightDamage, oathAttackStamina, takesDeepGuardCut, troopMark } from "@bibliothecadao/eternum";
import { nativeRuleConstants, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { revealsAtScoutCost } from "@bibliothecadao/eternum/troop-stamina";
import { TroopType } from "@bibliothecadao/types";

export interface ArmyStaminaCosts {
  reveal: number;
  attack: number;
}

export const troopFigures = (store: Pick<NativeFactStore, "require">, gameId: number): TroopFigures => ({
  lightCut: 100 - nativeRuleConstants.FRONTIER_LIGHT_DAMAGE_PERCENT,
  guardCut: 100 - nativeRuleConstants.FRONTIER_KNIGHT_GUARD_DAMAGE_PERCENT,
  scoutReveal: exploreStaminaOf(store, gameId, TroopType.Paladin, 0),
  baseReveal: exploreStaminaOf(store, gameId, TroopType.Knight, 0),
  attackStamina: store.require("SliceRules", { game_id: gameId }).troop_stamina_config.stamina_attack_req,
});

export const armyStaminaCosts = (store: NativeFactStore, army: NativeRows["ExplorerTroops"]): ArmyStaminaCosts => {
  const oaths = armyOaths(store, army);
  const baseAttack = store.require("SliceRules", { game_id: army.game_id }).troop_stamina_config.stamina_attack_req;
  return {
    reveal: exploreStaminaOf(store, army.game_id, army.troops.category, oaths),
    attack: oathAttackStamina(oaths, baseAttack),
  };
};

export const troopTraits = (category: TroopType): TroopTraits => ({
  mark: troopMark(category),
  light: dealsLightDamage(category),
  guard: takesDeepGuardCut(category),
  scout: revealsAtScoutCost(category),
});
