import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { ArmyChip } from "@/ui/components/military/army-chip";
import { battleSimulation } from "@/ui/components/navigation/config";
import Button from "@/ui/elements/button";
import { Headline } from "@/ui/elements/headline";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { CombatSimulation } from "@/ui/modules/simulation/combat-simulation";
import { divideByPrecisionFormatted } from "@/ui/utils/utils";
import { useExplorersByStructure } from "@bibliothecadao/react";
import { ArmyInfo, ID, ResourcesIds, TroopType } from "@bibliothecadao/types";

export const EntitiesArmyTable = () => {
  const playerStructures = useUIStore((state) => state.playerStructures);
  const togglePopup = useUIStore((state) => state.togglePopup);

  return (
    <>
      <div className="w-full flex justify-center mt-4">
        <Button variant="primary" className="mx-auto" size="md" onClick={() => togglePopup(battleSimulation)}>
          Simulate a battle
        </Button>
      </div>
      <CombatSimulation />
      {playerStructures.map((entity: any, index: number) => {
        return <StructureWithArmy key={entity.entityId} entity={entity} showHint={index === 0} />;
      })}
    </>
  );
};

const StructureWithArmy = ({ entity, showHint }: { entity: any; showHint: boolean }) => {
  const explorers = useExplorersByStructure({ structureEntityId: entity.entityId });

  // Skip rendering if there are no armies
  if (explorers.length === 0) {
    return null;
  }

  return (
    <div className="p-2">
      <Headline>
        <div className="flex gap-2">
          <div className="self-center">{entity.name} </div>
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
