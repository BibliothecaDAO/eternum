import { TroopType } from "@bibliothecadao/types";
import { type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";
import { oathExploreStamina } from "./oaths";

/** Scouts reveal twice as far on an expedition bar; other modes keep their configured troop cost. */
export function exploreStaminaCost(
  rules: Pick<NativeRows["SliceRules"], "day_unit_seconds" | "troop_stamina_config">,
  category: TroopType,
  oaths: number,
): number {
  const base = rules.troop_stamina_config.stamina_explore_stamina_cost;
  const cost =
    rules.day_unit_seconds !== 0 && category === TroopType.Paladin ? nativeRuleConstants.SCOUT_EXPLORE_STAMINA : base;
  return oathExploreStamina(oaths, cost);
}
