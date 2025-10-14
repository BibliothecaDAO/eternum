import { getBlockTimestamp } from "@bibliothecadao/eternum";

import { configManager, getEntityIdFromKeys, getIsBlitz, getStructureRelicEffects, getStructureName } from "@bibliothecadao/eternum";
import { useBuildings, useDojo } from "@bibliothecadao/react";
import { getProducedResource, RealmInfo as RealmInfoType, RELICS, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { SparklesIcon } from "lucide-react";
import { useMemo } from "react";
import { ActiveRelicEffects } from "../../world/components/entities/active-relic-effects";
import { BuildingsList } from "./buildings-list";
import { ProductionControls } from "./production-controls";
import { RealmInfo } from "./realm-info";
import { RealmAutomationPanel } from "./realm-automation-panel";

export const ProductionBody = ({
  realm,
  selectedResource,
  onSelectResource,
}: {
  realm: RealmInfoType;
  selectedResource: ResourcesIds | null;
  onSelectResource: (resource: ResourcesIds | null) => void;
}) => {
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
    return getStructureName(realm.structure, getIsBlitz()).name;
  }, [realm.structure]);

  const entityType = useMemo(() => {
    const category = Number(realm.structure?.category ?? 0);
    return category === StructureType.Village ? "village" : "realm";
  }, [realm.structure?.category]);

  return (
    <>
      <div className="space-y-2">
        <RealmInfo realm={realm} />
        <ActiveRelicEffects relicEffects={activeRelics} entityId={realm.entityId} />
        {hasActivatedWonderBonus && (
          <div className="bg-gradient-to-r from-gold/20 to-gold/5 border-2 border-gold/30 rounded-lg px-6 py-4 shadow-lg shadow-gold/10 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5"></div>
            <div className="relative">
              <div className="flex items-center gap-4">
                <div className="bg-gold/20 p-3 rounded-lg">
                  <SparklesIcon className="w-7 h-7 text-gold" />
                </div>
                <div>
                  <h6 className="text-gold font-bold text-lg mb-1">Wonder Bonus Active</h6>
                  <p className="text-gold/90 text-sm">
                    ✨ Currently receiving +{((wonderBonus - 1) * 100).toFixed(2)}% production bonus
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <RealmAutomationPanel
          realmEntityId={realm.entityId.toString()}
          realmName={realmDisplayName}
          producedResources={producedResources}
          entityType={entityType}
        />

        <BuildingsList
          realm={realm}
          onSelectProduction={onSelectResource}
          selectedResource={selectedResource}
          producedResources={producedResources}
          productionBuildings={productionBuildings}
        />

        {selectedResource && (
          <ProductionControls
            selectedResource={selectedResource}
            realm={realm}
            wonderBonus={wonderBonus}
            productionBonus={productionBonus}
            troopsBonus={troopsBonus}
          />
        )}
      </div>
    </>
  );
};
