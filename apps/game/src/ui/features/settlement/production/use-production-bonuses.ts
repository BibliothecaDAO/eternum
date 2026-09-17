import { configManager } from "@bibliothecadao/eternum";
import { useNativeRow } from "@bibliothecadao/react";
import { useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";

export function useProductionBonuses(entityId: number) {
  const bonus = useNativeRow("ProductionBonus", { game_id: configManager.getActiveGameId(), entity_id: entityId });
  const tick = useCurrentArmiesTick();
  const multiplier = (percent: number, end: number) => (tick <= end ? 1 + percent / 10_000 : 1);
  return {
    productionBonus: bonus ? multiplier(bonus.incr_resource_rate_percent_num, bonus.incr_resource_rate_end_tick) : 1,
    laborBonus: bonus ? multiplier(bonus.incr_labor_rate_percent_num, bonus.incr_labor_rate_end_tick) : 1,
    troopsBonus: bonus ? multiplier(bonus.incr_troop_rate_percent_num, bonus.incr_troop_rate_end_tick) : 1,
  };
}
