import { exploreStaminaOf } from "@/lib/army-stamina/explore-stamina";
import type { TroopFigures } from "@/ui/design-system/kit/words";
import { nativeRuleConstants, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { TroopType } from "@bibliothecadao/types";

export const troopFigures = (store: Pick<NativeFactStore, "require">, gameId: number): TroopFigures => ({
  lightCut: 100 - nativeRuleConstants.FRONTIER_LIGHT_DAMAGE_PERCENT,
  guardCut: 100 - nativeRuleConstants.FRONTIER_KNIGHT_GUARD_DAMAGE_PERCENT,
  scoutReveal: exploreStaminaOf(store, gameId, TroopType.Paladin, 0),
  baseReveal: exploreStaminaOf(store, gameId, TroopType.Knight, 0),
});
