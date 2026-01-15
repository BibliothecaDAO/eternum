import { getBlockTimestamp } from "@bibliothecadao/eternum";

import { configManager, getEntityIdFromKeys, getStructureRelicEffects } from "@bibliothecadao/eternum";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useBuildings, useDojo } from "@bibliothecadao/react";
import { getProducedResource, RealmInfo as RealmInfoType, RELICS, ResourcesIds } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { ProductionWorkflows } from "./production-workflows";

export const ProductionBody = ({
  realm,
  selectedResource,
  onSelectResource,
}: {
  realm: RealmInfoType;
  selectedResource: ResourcesIds | null;
  onSelectResource: (resource: ResourcesIds | null) => void;
}) => {
  const mode = useGameModeConfig();
  const {
    setup: {
      components: { ProductionBoostBonus },
    },
  } = useDojo();

  const productionBoostBonus = getComponentValue(ProductionBoostBonus, getEntityIdFromKeys([BigInt(realm.entityId)]));

  const { wonderBonus, hasActivatedWonderBonus } = useMemo(() => {
    const wonderBonusConfig = configManager.getWonderBonusConfig();
    const hasActivatedWonderBonus = productionBoostBonus && productionBoostBonus.wonder_incr_percent_num > 0;
    return {
      wonderBonus: hasActivatedWonderBonus ? 1 + wonderBonusConfig.bonusPercentNum / 10000 : 1,
      hasActivatedWonderBonus,
    };
  }, [realm.entityId, productionBoostBonus]);

  const activeRelics = useMemo(() => {
    if (!productionBoostBonus) return [];
    return getStructureRelicEffects(productionBoostBonus, getBlockTimestamp().currentArmiesTick);
  }, [productionBoostBonus]);

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

  const buildings = useBuildings(realm.position.x, realm.position.y);
  const productionBuildings = buildings.filter((building) => building && getProducedResource(building.category));
  const producedResources = useMemo(
    () =>
      Array.from(
        new Set(
          productionBuildings
            .filter((building) => building.produced && building.produced.resource)
            .map((building) => building.produced.resource as ResourcesIds),
        ),
      ),
    [productionBuildings],
  );

  const realmDisplayName = useMemo(() => {
    return mode.structure.getName(realm.structure).name;
  }, [mode.structure, realm.structure]);

  return (
    <ProductionWorkflows
      realm={realm}
      realmDisplayName={realmDisplayName}
      producedResources={producedResources}
      productionBuildings={productionBuildings}
      selectedResource={selectedResource}
      onSelectResource={onSelectResource}
      wonderBonus={wonderBonus}
      productionBonus={productionBonus}
      troopsBonus={troopsBonus}
      realmEntityId={realm.entityId.toString()}
    />
  );
};
