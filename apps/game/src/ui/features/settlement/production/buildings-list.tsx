import { HUD_BODY, HUD_BODY_MUTED, HUD_HEADLINE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useCoarseCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { ResourceChip } from "@/ui/features/economy/resources";

import {
  configManager,
  getEntityIdFromKeys,
  getRealmInfo,
  getStructureRelicEffects,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { Building, RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { useMemo } from "react";
import { gameEntityKey } from "@/sync/game-scope";

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
  const currentDefaultTick = useCoarseCurrentDefaultTick();
  // Guard against invalid realm data to prevent crashes
  if (!realm || !realm.position || !realm.entityId) {
    return <p className={cn(HUD_BODY_MUTED, "p-3")}>Realm data is currently unavailable.</p>;
  }

  const { setup } = useDojo();

  const resourceManager = useResourceManager(realm.entityId);
  const resources = useComponentValue(setup.components.Resource, gameEntityKey([BigInt(realm.entityId)]));

  const structureBuildings = useComponentValue(
    setup.components.StructureBuildings,
    gameEntityKey([BigInt(realm.entityId)]),
  );

  const productionBoostBonus = useComponentValue(
    setup.components.ProductionBoostBonus,
    gameEntityKey([BigInt(realm.entityId)]),
  );

  const realmInfo = useMemo(
    () => getRealmInfo(gameEntityKey([BigInt(realm.entityId)]), setup.components),
    [realm.entityId, structureBuildings, resources],
  );

  const resource = useMemo(() => {
    return resourceManager.getResource();
  }, [resourceManager]);

  const activeRelicEffects = useMemo(() => {
    if (!productionBoostBonus) return [];
    return getStructureRelicEffects(productionBoostBonus, currentDefaultTick);
  }, [productionBoostBonus, currentDefaultTick]);

  const productions = useMemo(() => {
    const isLaborProductionEnabled = configManager.isLaborProductionEnabled();
    return producedResources
      .filter((resourceId) => {
        // Exclude Labor if labor production is not enabled
        if (resourceId === ResourcesIds.Labor && !isLaborProductionEnabled) {
          return false;
        }
        return true;
      })
      .map((resourceId) => {
        const buildingsForResource = productionBuildings.filter(
          (building) => building.produced.resource === resourceId,
        );

        if (!resource) return null;
        const production = ResourceManager.balanceAndProduction(resource, resourceId).production;

        return {
          resource: resourceId,
          production,
          buildings: buildingsForResource,
          isLabor: resourceId === ResourcesIds.Labor,
        };
      })
      .filter((production) => production !== null);
  }, [producedResources, productionBuildings, resourceManager, resource, currentDefaultTick]);

  const selectedProduction =
    selectedResource !== null ? productions.find((p) => p.resource === selectedResource) : null;

  if (selectedResource !== null) {
    if (!selectedProduction) {
      return <p className={cn(HUD_BODY_MUTED, "p-3")}>Loading production data…</p>;
    }

    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-gold/15 bg-black/25 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <ResourceIcon resource={ResourcesIds[selectedProduction.resource]} size="md" />
          <div className="min-w-0">
            <h4 className={cn(HUD_HEADLINE, "truncate")}>{ResourcesIds[selectedProduction.resource]}</h4>
            <span className={HUD_BODY}>
              {selectedProduction.buildings.length} building{selectedProduction.buildings.length !== 1 ? "s" : ""}{" "}
              producing
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelectProduction(null)}
          className="rounded-md border border-gold/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/80 transition hover:border-gold/50 hover:text-gold"
        >
          Change resource
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {productions.length === 0 ? (
        <p className={cn(HUD_BODY_MUTED, "p-3")}>Build production buildings first to start producing resources.</p>
      ) : (
        productions.map((production) => {
          return (
            <div
              key={production.resource}
              onClick={() => onSelectProduction(production.resource)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectProduction(production.resource);
                }
              }}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-gold/15 bg-black/25 px-3 py-2 transition hover:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/60"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <ResourceIcon resource={ResourcesIds[production.resource]} size="md" />
                <div className="min-w-0">
                  <h4 className={cn(HUD_HEADLINE, "truncate")}>{ResourcesIds[production.resource]}</h4>
                  <span className={HUD_BODY}>
                    {production.buildings.length} building{production.buildings.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="w-[320px] max-w-[55%]">
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
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
