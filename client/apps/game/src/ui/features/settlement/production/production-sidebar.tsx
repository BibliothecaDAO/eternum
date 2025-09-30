import { getIsBlitz } from "@bibliothecadao/eternum";

import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import {
  configManager,
  getEntityIdFromKeys,
  getStructureName,
  getStructureRelicEffects,
} from "@bibliothecadao/eternum";
import { useBuildings, useDojo, useResourceManager } from "@bibliothecadao/react";
import { getProducedResource, ID, RealmInfo, resources, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { HasValue, runQuery } from "@dojoengine/recs";
import { SparklesIcon } from "lucide-react";
import { memo, useMemo } from "react";
import { ResourceChip } from "../../economy/resources";

interface ProductionSidebarProps {
  realms: RealmInfo[];
  selectedRealmEntityId: ID;
  onSelectRealm: (id: ID) => void;
  onSelectResource: (realmId: ID, resource: ResourcesIds) => void;
}

const SidebarRealm = ({
  realm,
  isSelected,
  onSelect,
  onSelectResource,
}: {
  realm: RealmInfo;
  isSelected: boolean;
  onSelect: () => void;
  onSelectResource: (realmId: ID, resource: ResourcesIds) => void;
}) => {
  const {
    setup: {
      components: { Building, Resource, ProductionBoostBonus },
    },
  } = useDojo();

  const buildings = useMemo(() => {
    const buildings = runQuery([
      HasValue(Building, {
        outer_entity_id: realm.entityId,
      }),
    ]);

    return buildings;
  }, [realm]);

  // Get production data
  const buildingsData = useBuildings(realm.position.x, realm.position.y);
  const productionBuildings = buildingsData.filter((building) => building && getProducedResource(building.category));
  const producedResources = Array.from(
    new Set(
      productionBuildings
        .filter((building) => building.produced && building.produced.resource)
        .map((building) => building.produced.resource),
    ),
  );

  // Get resource manager for production rates
  const resourceManager = useResourceManager(realm.entityId);
  const resourceData = useComponentValue(Resource, getEntityIdFromKeys([BigInt(realm.entityId)]));

  // Get bonuses
  const productionBoostBonus = useComponentValue(ProductionBoostBonus, getEntityIdFromKeys([BigInt(realm.entityId)]));

  const { wonderBonus, hasActivatedWonderBonus } = useMemo(() => {
    const wonderBonusConfig = configManager.getWonderBonusConfig();
    const hasActivatedWonderBonus = productionBoostBonus && productionBoostBonus.wonder_incr_percent_num > 0;
    return {
      wonderBonus: hasActivatedWonderBonus ? 1 + wonderBonusConfig.bonusPercentNum / 10000 : 1,
      hasActivatedWonderBonus,
    };
  }, [productionBoostBonus]);

  const activeRelics = useMemo(() => {
    if (!productionBoostBonus) return [];
    return getStructureRelicEffects(productionBoostBonus, getBlockTimestamp().currentArmiesTick);
  }, [productionBoostBonus]);

  return (
    <div
      onClick={onSelect}
      className={`px-4 py-3 rounded-lg panel-wood cursor-pointer transition-all transform hover:scale-[1.02] ${
        isSelected ? "panel-gold  shadow-lg" : "border-transparent hover:bg-gold/5"
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-xl font-bold text-gold">{getStructureName(realm.structure, getIsBlitz()).name}</h3>
          <p className="text-sm text-gold/60">
            {buildings.size} buildings • {productionBuildings.length} producing
          </p>
        </div>
        {/* Active Bonuses */}
        {(hasActivatedWonderBonus || activeRelics.length > 0) && (
          <div className="flex gap-1">
            {hasActivatedWonderBonus && (
              <div className="bg-gold/20 p-1 rounded" title={`Wonder Bonus: +${((wonderBonus - 1) * 100).toFixed(2)}%`}>
                <SparklesIcon className="w-4 h-4 text-gold" />
              </div>
            )}
            {activeRelics.length > 0 && (
              <div className="bg-relic-activated/20 p-1 rounded" title={`${activeRelics.length} Active Relics`}>
                <span className="text-xs font-bold text-relic-activated">{activeRelics.length}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resource Production */}
      {producedResources.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gold/80 mb-1">Production:</h4>
          <div className="grid grid-cols-1 gap-1">
            {producedResources.map((resourceId) => {
              const buildingCount = productionBuildings.filter((b) => b.produced.resource === resourceId).length;

              return (
                <div key={resourceId} className="flex items-center bg-dark-brown/50 rounded px-2 py-1 gap-3">
                  <div className="flex items-center gap-1">
                    <ResourceIcon resource={ResourcesIds[resourceId]} size="xs" />
                    <span className="text-xs text-gold/80">{buildingCount}b</span>
                  </div>
                  <div className="">
                    <ResourceChip
                      resourceId={resourceId}
                      resourceManager={resourceManager}
                      size="default"
                      showTransfer={false}
                      storageCapacity={0}
                      storageCapacityUsed={0}
                      activeRelicEffects={activeRelics}
                      canOpenProduction={buildingCount > 0}
                      onManageProduction={(resource) => onSelectResource(realm.entityId, resource)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gold/60 text-center py-2">No production buildings</div>
      )}

      {/* Realm Resources (Compact) */}
      <div className="flex flex-wrap gap-1 mt-3 pt-2 border-t border-gold/20">
        {Object.values(realm.resources).map((resource) => {
          return (
            <ResourceIcon
              key={resource}
              resource={resources.find((r) => r.id === resource)?.trait || ""}
              size="xs"
              className="opacity-60"
            />
          );
        })}
      </div>
    </div>
  );
};

export const ProductionSidebar = memo(({ realms, selectedRealmEntityId, onSelectRealm, onSelectResource }: ProductionSidebarProps) => {
  return (
    <div className="space-y-4">
      {realms.map((realm) => (
        <SidebarRealm
          key={realm.entityId}
          realm={realm}
          isSelected={realm.entityId === selectedRealmEntityId}
          onSelect={() => onSelectRealm(realm.entityId)}
          onSelectResource={onSelectResource}
        />
      ))}
    </div>
  );
});
