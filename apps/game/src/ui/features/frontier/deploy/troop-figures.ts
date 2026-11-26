import { exploreStaminaOf } from "@/lib/army-stamina/explore-stamina";
import type { TroopFigures, TroopTraits } from "@/ui/design-system/kit/words";
import { dealsLightDamage, takesDeepGuardCut, troopMark } from "@bibliothecadao/eternum";
import { nativeRuleConstants, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { revealsAtScoutCost } from "@bibliothecadao/eternum/troop-stamina";
import { TroopType } from "@bibliothecadao/types";

export const troopFigures = (store: Pick<NativeFactStore, "require">, gameId: number): TroopFigures => ({
  lightCut: 100 - nativeRuleConstants.FRONTIER_LIGHT_DAMAGE_PERCENT,
  guardCut: 100 - nativeRuleConstants.FRONTIER_KNIGHT_GUARD_DAMAGE_PERCENT,
  scoutReveal: exploreStaminaOf(store, gameId, TroopType.Paladin, 0),
  baseReveal: exploreStaminaOf(store, gameId, TroopType.Knight, 0),
});

export const troopTraits = (category: TroopType): TroopTraits => ({
  mark: troopMark(category),
  light: dealsLightDamage(category),
  guard: takesDeepGuardCut(category),
  scout: revealsAtScoutCost(category),
});
