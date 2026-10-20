import { configManager, bonusActive } from "@bibliothecadao/eternum";
import { useNativeRowOrAbsent } from "@/hooks/helpers/use-native-facts";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";

/**
 * The realm's running production bonuses, each in ten-thousandths of the output as the chain adds it (0 when it is not
 * running): resources, labor and troops, each for the output of its kind. Undefined until the realm's row arrives.
 */
export function useProductionBonuses(entityId: number) {
  const bonus = useNativeRowOrAbsent("ProductionBonus", {
    game_id: configManager.getActiveGameId(),
    entity_id: entityId,
  });
  const timestamp = useCurrentDefaultTick();
  const running = (percent: number, end: number) => (bonusActive(end, timestamp) ? percent : 0);
  if (!bonus) return undefined;
  return {
    production: running(bonus.incr_resource_rate_percent_num, bonus.incr_resource_rate_end_at),
    labor: running(bonus.incr_labor_rate_percent_num, bonus.incr_labor_rate_end_at),
    troops: running(bonus.incr_troop_rate_percent_num, bonus.incr_troop_rate_end_at),
  };
}
