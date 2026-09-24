import { HUD_BODY, HUD_BODY_MUTED, HUD_HEADLINE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useCoarseCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { ResourceChip } from "@/ui/features/economy/resources";

import { configManager, getRealmInfo, getStructureRelicEffects } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { Building, RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";
import { getPlayerName } from "@/services/identity/player-profiles";

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
  const { setup } = useGame();

  const resourceManager = useResourceManager(realm.entityId);
  const keys = { game_id: configManager.getActiveGameId(), entity_id: realm.entityId };
  const structureBuildings = useNativeRow("StructureBuildings", keys);
  const productionBoostBonus = useNativeRow("ProductionBonus", keys);
  const realmInfo = useMemo(
    () => getRealmInfo(realm.entityId, setup.store, getPlayerName),
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
