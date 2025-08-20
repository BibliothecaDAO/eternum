import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { Headline } from "@/ui/design-system/molecules/headline";
import { HintModalButton } from "@/ui/design-system/molecules/hint-modal-button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { battleSimulation } from "@/ui/features";
import { HintSection } from "@/ui/features/progression/hints/hint-modal";
import { CombatSimulation } from "@/ui/modules/simulation/combat-simulation";
import { divideByPrecisionFormatted } from "@/ui/utils/utils";
import { useDojo, useExplorersByStructure } from "@bibliothecadao/react";
import { ArmyInfo, ClientComponents, ID, ResourcesIds, TroopType } from "@bibliothecadao/types";
import { HasValue, runQuery } from "@dojoengine/recs";
import { PlusIcon } from "lucide-react";
import { ArmyChip } from "./army-chip";
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
      <div className="w-full flex justify-center mt-4 gap-2">
        <Button variant="primary" className="mx-auto" size="md" onClick={() => togglePopup(battleSimulation)}>
          Simulate a battle
        </Button>

        {playerStructures.length > 0 && (
          <>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                toggleModal(
                  <UnifiedArmyCreationModal structureId={playerStructures[0]?.entityId || 0} isExplorer={true} />,
                );
              }}
              className="flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Create Attack
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
              className="flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Create Defense
            </Button>
          </>
        )}
      </div>
      <CombatSimulation />
      {!hasAnyArmies ? (
        <div className="text-center mt-8 p-6 bg-gold/10 rounded-lg">
          <p className="text-gold mb-2">You don't have any Field Armies</p>
          <p className="text-sm text-gold/60">
            To build one, go to the local view of your realm and ensure you have troops in your balance
          </p>
        </div>
      ) : (
        playerStructures.map((entity: any, index: number) => {
          return <StructureWithArmy key={entity.entityId} entity={entity} showHint={index === 0} />;
        })
      )}
    </>
  );
};

const StructureWithArmy = ({ entity, showHint }: { entity: any; showHint: boolean }) => {
  const explorers = useExplorersByStructure({ structureEntityId: entity.entityId });

  // Always show structure if it has armies
  const shouldShow = explorers.length > 0;

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="p-2 rounded-lg">
      <Headline>
        <div className="flex gap-2 items-center">
          <div className="self-center">{entity.name}</div>

          {showHint && <HintModalButton section={HintSection.Buildings} />}
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
