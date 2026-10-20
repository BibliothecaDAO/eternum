import { HudButton, HudRow } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { ResourceChip } from "@/ui/features/economy/resources";

import { configManager, getRealmInfo, getStructureRelicEffects } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRowOrAbsent, useNativeRow } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { Building, RealmInfo, ResourcesIds, formatCount, resourceName } from "@bibliothecadao/types";
import { useMemo } from "react";
import { getPlayerDisplayName } from "@/services/identity/player-profiles";

export const BuildingsList = ({
  realm,
  onSelectProduction,
  selectedResource,
  producedResources,
  productionBuildings,
}: {
  realm: RealmInfo;
  onSelectProduction: (resource: ResourcesIds | null) => void;
  selectedResource: ResourcesIds | null;
  producedResources: ResourcesIds[];
  productionBuildings: Building[];
}) => {
  const currentDefaultTick = useCurrentDefaultTick();
  const { setup } = useGame();

  const resourceManager = useResourceManager(realm.entityId);
  const keys = { game_id: configManager.getActiveGameId(), entity_id: realm.entityId };
  const structureBuildings = useNativeRow("StructureBuildings", keys);
  const productionBoostBonus = useNativeRowOrAbsent("ProductionBonus", keys);
  const realmInfo = useMemo(
    () => getRealmInfo(realm.entityId, setup.store, getPlayerDisplayName),
    [realm.entityId, setup.store, structureBuildings, resourceManager],
  );

  const activeRelicEffects = useMemo(() => {
    if (!productionBoostBonus) return [];
    return getStructureRelicEffects(productionBoostBonus, currentDefaultTick);
  }, [productionBoostBonus, currentDefaultTick]);

  const productions = useMemo(() => {
    return producedResources
      .map((resourceId) => {
        const buildingsForResource = productionBuildings.filter(
          (building) => building.produced.resource === resourceId,
        );

        const current = resourceManager.current(resourceId);
        if (!current) return null;
        const production = current.production;

        return {
          resource: resourceId,
          production,
          buildings: buildingsForResource,
        };
      })
      .filter((production) => production !== null);
  }, [producedResources, productionBuildings, resourceManager, currentDefaultTick]);

  const selectedProduction =
    selectedResource !== null ? productions.find((p) => p.resource === selectedResource) : null;

  if (!productionBoostBonus) return <p>Loading production…</p>;

  if (selectedResource !== null) {
    if (!selectedProduction) {
      return <p className="text-hud-muted">Loading production data…</p>;
    }

    return (
      <HudRow
        lead={<ResourceIcon resource={selectedProduction.resource} size="md" />}
        title={resourceName(selectedProduction.resource)}
        detail={`${formatCount(selectedProduction.buildings.length, "building")} producing`}
        trail={
          <HudButton kind="secondary" size="sm" onClick={() => onSelectProduction(null)}>
            Change resource
          </HudButton>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {productions.length === 0 ? (
        <p className="text-hud-muted">Build production buildings first to start producing resources.</p>
      ) : (
        productions.map((production) => (
          <HudRow
            key={production.resource}
            lead={<ResourceIcon resource={production.resource} size="md" />}
            title={resourceName(production.resource)}
            detail={formatCount(production.buildings.length, "building")}
            onClick={() => onSelectProduction(production.resource)}
            trail={
              <span className="w-80 max-w-full">
                <ResourceChip
                  resourceId={production.resource}
                  resourceManager={resourceManager}
                  showTransfer={false}
                  storageCapacity={realmInfo?.storehouses?.capacityKg}
                  storageCapacityUsed={realmInfo?.storehouses?.capacityUsedKg}
                  activeRelicEffects={activeRelicEffects}
                  canOpenProduction={production.buildings.length > 0}
                  onManageProduction={(resource) => onSelectProduction(resource)}
                />
              </span>
            }
          />
        ))
      )}
    </div>
  );
};
