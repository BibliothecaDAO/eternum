import { configManager, getStructureRelicEffects } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { RELICS, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { useMemo } from "react";
import { gameEntityKey } from "@bibliothecadao/eternum/game-client";
import { useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";

export function useProductionBonuses(entityId: number) {
  const {
    setup: {
      components: { ProductionBoostBonus },
    },
  } = useDojo();

  const productionBoostBonus = useComponentValue(ProductionBoostBonus, gameEntityKey([BigInt(entityId)]));
  const currentArmiesTick = useCurrentArmiesTick();

  const { wonderBonus } = useMemo(() => {
    const wonderBonusConfig = configManager.getWonderBonusConfig();
    const hasActivatedWonderBonus = productionBoostBonus && productionBoostBonus.wonder_incr_percent_num > 0;
    return {
      wonderBonus: hasActivatedWonderBonus ? 1 + wonderBonusConfig.bonusPercentNum / 10000 : 1,
      hasActivatedWonderBonus,
    };
  }, [entityId, productionBoostBonus]);

  const activeRelics = useMemo(() => {
    if (!productionBoostBonus) return [];
    return getStructureRelicEffects(productionBoostBonus, currentArmiesTick);
  }, [productionBoostBonus, currentArmiesTick]);

  const troopsBonus = useMemo(() => {
    if (activeRelics.find((relic) => relic.id === ResourcesIds.TroopProductionRelic1)) {
      return Number(RELICS.find((relic) => relic.id === ResourcesIds.TroopProductionRelic1)?.bonus) || 1;
    } else if (activeRelics.find((relic) => relic.id === ResourcesIds.TroopProductionRelic2)) {
      return Number(RELICS.find((relic) => relic.id === ResourcesIds.TroopProductionRelic2)?.bonus) || 1;
    } else {
      return 1;
    }
  }, [activeRelics]);

  const productionBonus = useMemo(() => {
    let bonus = 1;
    if (activeRelics.find((relic) => relic.id === ResourcesIds.ProductionRelic1)) {
      bonus = Number(RELICS.find((relic) => relic.id === ResourcesIds.ProductionRelic1)?.bonus) || 1;
    }
    if (activeRelics.find((relic) => relic.id === ResourcesIds.ProductionRelic2)) {
      bonus = Number(RELICS.find((relic) => relic.id === ResourcesIds.ProductionRelic2)?.bonus) || 1;
    }
    return bonus;
  }, [activeRelics]);

  return { wonderBonus, productionBonus, troopsBonus };
}
