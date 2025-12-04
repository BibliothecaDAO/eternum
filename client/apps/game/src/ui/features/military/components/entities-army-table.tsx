import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { Headline } from "@/ui/design-system/molecules/headline";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ViewOnMapIcon } from "@/ui/design-system/molecules/view-on-map-icon";
import { battleSimulation } from "@/ui/features";
import { divideByPrecisionFormatted } from "@/ui/utils/utils";
import { Position, getIsBlitz, getStructureName } from "@bibliothecadao/eternum";
import { useDojo, useExplorersByStructure } from "@bibliothecadao/react";
import { ArmyInfo, ClientComponents, ID, ResourcesIds, TroopType } from "@bibliothecadao/types";
import { HasValue, runQuery } from "@dojoengine/recs";
import { CrosshairIcon, ShieldIcon, SwordIcon } from "lucide-react";
import { ArmyChip, NavigateToPositionIcon } from "./army-chip";
import { UnifiedArmyCreationModal } from "./unified-army-creation-modal";

const getArmiesCountByStructure = (structureEntityId: ID, components: ClientComponents) => {
  const armies = runQuery([HasValue(components.ExplorerTroops, { owner: structureEntityId })]);
  return armies.size;
};

export const EntitiesArmyTable = () => {
  const {
    setup: { components },
  } = useDojo();

  const playerStructures = useUIStore((state) => state.playerStructures);
  const togglePopup = useUIStore((state) => state.togglePopup);
  const toggleModal = useUIStore((state) => state.toggleModal);

  // Check if any structure has armies
  const hasAnyArmies = playerStructures.some((entity: any) => {
    const armyCount = getArmiesCountByStructure(entity.entityId, components);
    return armyCount > 0;
  });

  return (
    <>
      <div className="mt-8 flex w-full justify-center px-3">
        <div className="flex w-full max-w-3xl flex-col gap-4 rounded-xl border border-gold/30 bg-brown/15 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/70">Military operations</span>
              <span className="text-xs text-gold/60 sm:text-sm">
                Plan your next move: run a simulation or deploy new attack and defense armies.
              </span>
            </div>
            <Button
              variant="primary"
              size="md"
              className="flex items-center gap-2 whitespace-nowrap"
              onClick={() => togglePopup(battleSimulation)}
            >
              <CrosshairIcon className="h-4 w-4" />
              Simulate battle
            </Button>
          </div>

          {playerStructures.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs font-semibold uppercase tracking-wide text-gold/70 sm:text-sm">
                Create armies
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    toggleModal(
                      <UnifiedArmyCreationModal structureId={playerStructures[0]?.entityId || 0} isExplorer={true} />,
                    );
                  }}
                  className="rounded-full"
                  aria-label="Create attack army"
                  title="Create attack army"
                >
                  <SwordIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    toggleModal(
                      <UnifiedArmyCreationModal
                        structureId={playerStructures[0]?.entityId || 0}
                        isExplorer={false}
                        maxDefenseSlots={playerStructures[0]?.structure.base.troop_max_guard_count}
                      />,
                    );
                  }}
                  className="rounded-full"
                  aria-label="Create defense army"
                  title="Create defense army"
                >
                  <ShieldIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {!hasAnyArmies ? (
        <div className="text-center mt-8 p-6 bg-gold/10 rounded-lg">
          <p className="text-gold mb-2">You don't have any Field Armies</p>
          <p className="text-sm text-gold/60">
            To build one, go to the local view of your realm and ensure you have troops in your balance
          </p>
        </div>
      ) : (
        playerStructures.map((entity: any) => {
          return <StructureWithArmy key={entity.entityId} entity={entity} />;
        })
      )}
    </>
  );
};

const StructureWithArmy = ({ entity }: { entity: any }) => {
  const explorers = useExplorersByStructure({ structureEntityId: entity.entityId });

  if (explorers.length === 0) {
    return null;
  }

  const structureComponent = entity.structure;
  const isBlitz = getIsBlitz();
  const structureName = structureComponent ? getStructureName(structureComponent, isBlitz).name : undefined;
  const displayName = structureName || entity.name || `Structure ${entity.entityId}`;
  const structurePosition = structureComponent?.base
    ? new Position({
        x: Number(structureComponent.base.coord_x ?? 0),
        y: Number(structureComponent.base.coord_y ?? 0),
      })
    : null;
  const showActions = Boolean(structurePosition);

  return (
    <div className="p-2 rounded-lg">
      <Headline>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-semibold text-gold">{displayName}</span>
          {showActions && (
            <div className="flex items-center gap-2">
              {structurePosition && (
                <>
                  <ViewOnMapIcon position={structurePosition} />
                  <NavigateToPositionIcon position={structurePosition} tooltipContent="Point compass" />
                </>
              )}
            </div>
          )}
        </div>
      </Headline>

      <div className="grid grid-cols-1 gap-4">
        <EntityArmyTable structureEntityId={entity.entityId} />
      </div>
    </div>
  );
};

const EntityArmyTable = ({ structureEntityId }: { structureEntityId: ID | undefined }) => {
  if (!structureEntityId) {
    return <div>Entity not found</div>;
  }
  const explorers = useExplorersByStructure({ structureEntityId });

  const totalTroops = explorers.reduce(
    (acc, army: ArmyInfo) => {
      return {
        crossbowmen: acc.crossbowmen + (army.troops.category === TroopType.Crossbowman ? Number(army.troops.count) : 0),
        paladins: acc.paladins + (army.troops.category === TroopType.Paladin ? Number(army.troops.count) : 0),
        knights: acc.knights + (army.troops.category === TroopType.Knight ? Number(army.troops.count) : 0),
      };
    },
    { crossbowmen: 0, paladins: 0, knights: 0 },
  );

  const armyElements = () => {
    return explorers.map((army: ArmyInfo) => {
      return <ArmyChip key={army.entityId} army={army} showButtons />;
    });
  };

  if (explorers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {(totalTroops.crossbowmen > 0 || totalTroops.knights > 0 || totalTroops.paladins > 0) && (
        <div className="text-sm text-gold/80">
          <div className="flex items-center justify-center gap-4 w-full">
            {totalTroops.crossbowmen > 0 && (
              <div className="flex items-center gap-2">
                <ResourceIcon resource={ResourcesIds[ResourcesIds.Crossbowman]} size="sm" className="self-center" />
                {divideByPrecisionFormatted(totalTroops.crossbowmen)}
              </div>
            )}
            {totalTroops.knights > 0 && (
              <div className="flex items-center gap-2">
                <ResourceIcon resource={ResourcesIds[ResourcesIds.Knight]} size="sm" className="self-center" />
                {divideByPrecisionFormatted(totalTroops.knights)}
              </div>
            )}
            {totalTroops.paladins > 0 && (
              <div className="flex items-center gap-2">
                <ResourceIcon resource={ResourcesIds[ResourcesIds.Paladin]} size="sm" className="self-center" />
                {divideByPrecisionFormatted(totalTroops.paladins)}
              </div>
            )}
          </div>
        </div>
      )}
      {armyElements()}
    </div>
  );
};
