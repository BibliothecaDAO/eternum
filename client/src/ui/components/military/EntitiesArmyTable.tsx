import { ArmyInfo, useArmiesByEntityOwner } from "@/hooks/helpers/useArmies";
import { useEntities } from "@/hooks/helpers/useEntities";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { BattleSimulation } from "@/ui/modules/battle-simulation/BattleSimulation";
import { ID } from "@bibliothecadao/eternum";
import { HintSection } from "../hints/HintModal";
import { battleSimulation } from "../navigation/Config";
import { ArmyChip } from "./ArmyChip";

export const EntitiesArmyTable = () => {
  const { playerStructures } = useEntities();
  const togglePopup = useUIStore((state) => state.togglePopup);

  return playerStructures().map((entity: any, index: number) => {
    return (
      <div key={entity.entity_id} className="p-2">
        <Headline>
          <div className="flex gap-2">
            <div className="self-center">{entity.name} </div>
            {index === 0 && <HintModalButton section={HintSection.Buildings} />}
          </div>
        </Headline>
        <div className="w-full flex justify-center">
          <Button variant="primary" className="mx-auto" size="xs" onClick={() => togglePopup(battleSimulation)}>
            Simulate a battle
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <EntityArmyTable structureEntityId={entity.entity_id} />
        </div>
        <BattleSimulation />
      </div>
    );
  });
};

const EntityArmyTable = ({ structureEntityId }: { structureEntityId: ID | undefined }) => {
  if (!structureEntityId) {
    return <div>Entity not found</div>;
  }
  const { entityArmies } = useArmiesByEntityOwner({ entity_owner_entity_id: structureEntityId });

  if (entityArmies.length === 0) {
    return <div className="m-auto">No armies</div>;
  }

  const armyElements = () => {
    return entityArmies.map((army: ArmyInfo) => {
      return <ArmyChip key={army.entity_id} army={army} showButtons />;
    });
  };

  return <div className="flex flex-col gap-4">{armyElements()}</div>;
};
