import { configManager } from "@bibliothecadao/eternum";
import { useNativeRowOrAbsent } from "@/hooks/helpers/use-native-facts";
import { useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";

export function useProductionBonuses(entityId: number) {
  const bonus = useNativeRowOrAbsent("ProductionBonus", {
    game_id: configManager.getActiveGameId(),
    entity_id: entityId,
  });
  const tick = useCurrentArmiesTick();
  const multiplier = (percent: number, end: number) => (tick <= end ? 1 + percent / 10_000 : 1);
  if (!bonus) return undefined;
  return {
    productionBonus: multiplier(bonus.incr_resource_rate_percent_num, bonus.incr_resource_rate_end_tick),
    laborBonus: multiplier(bonus.incr_labor_rate_percent_num, bonus.incr_labor_rate_end_tick),
    troopsBonus: multiplier(bonus.incr_troop_rate_percent_num, bonus.incr_troop_rate_end_tick),
  };
}
