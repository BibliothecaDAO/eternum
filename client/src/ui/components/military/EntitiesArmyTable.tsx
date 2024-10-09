import { ArmyInfo, useArmiesByEntityOwner } from "@/hooks/helpers/useArmies";
import { useEntities } from "@/hooks/helpers/useEntities";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { ID } from "@bibliothecadao/eternum";
import { HintSection } from "../hints/HintModal";
import { ArmyChip } from "./ArmyChip";

export const EntitiesArmyTable = () => {
  const { playerStructures } = useEntities();

  return playerStructures().map((entity: any, index: number) => {
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
