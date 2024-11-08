import { ArmyInfo, useArmiesByEntityOwner } from "@/hooks/helpers/useArmies";
import { useEntities } from "@/hooks/helpers/useEntities";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { BattleSimulation } from "@/ui/modules/battle-simulation/BattleSimulation";
import { divideByPrecision } from "@/ui/utils/utils";
import { ID, ResourcesIds } from "@bibliothecadao/eternum";
import { HintSection } from "../hints/HintModal";
import { battleSimulation } from "../navigation/Config";
import { ArmyChip } from "./ArmyChip";

export const EntitiesArmyTable = () => {
  const { playerStructures } = useEntities();
  const togglePopup = useUIStore((state) => state.togglePopup);

  return (
    <>
      <div className="w-full flex justify-center mt-4">
        <Button variant="primary" className="mx-auto" size="md" onClick={() => togglePopup(battleSimulation)}>
          Simulate a battle
        </Button>
      </div>
      <BattleSimulation />
      {playerStructures().map((entity: any, index: number) => {
        return (
          <div key={entity.entity_id} className="p-2">
            <Headline>
              <div className="flex gap-2">
                <div className="self-center">{entity.name} </div>
                {index === 0 && <HintModalButton section={HintSection.Buildings} />}
              </div>
            </Headline>
            <div className="grid grid-cols-1 gap-4">
              <EntityArmyTable structureEntityId={entity.entity_id} />
            </div>
          </div>
        );
      })}
    </>
  );
};

const EntityArmyTable = ({ structureEntityId }: { structureEntityId: ID | undefined }) => {
  if (!structureEntityId) {
    return <div>Entity not found</div>;
  }
  const { entityArmies } = useArmiesByEntityOwner({ entity_owner_entity_id: structureEntityId });

  const totalTroops = entityArmies.reduce(
    (acc, army: ArmyInfo) => {
      return {
        crossbowmen: Number(acc.crossbowmen) + Number(army.troops.crossbowman_count),
        paladins: Number(acc.paladins) + Number(army.troops.paladin_count),
        knights: Number(acc.knights) + Number(army.troops.knight_count),
      };
    },
    { crossbowmen: 0, paladins: 0, knights: 0 },
  );

  if (entityArmies.length === 0) {
    return <div className="m-auto">No armies</div>;
  }

  const armyElements = () => {
    return entityArmies.map((army: ArmyInfo) => {
      return <ArmyChip key={army.entity_id} army={army} showButtons />;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-gold/80">
        <div className="flex items-center justify-center gap-4 w-full">
          <div className="flex items-center gap-2">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Crossbowman]} size="sm" className="self-center" />
            {divideByPrecision(totalTroops.crossbowmen)}
          </div>
          <div className="flex items-center gap-2">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Knight]} size="sm" className="self-center" />
            {divideByPrecision(totalTroops.knights)}
          </div>
          <div className="flex items-center gap-2">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Paladin]} size="sm" className="self-center" />
            {divideByPrecision(totalTroops.paladins)}
          </div>
        </div>
      </div>
      {armyElements()}
    </div>
  );
};
