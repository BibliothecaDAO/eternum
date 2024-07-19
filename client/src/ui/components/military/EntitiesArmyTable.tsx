import { ArmyInfo, useArmiesByEntityOwner } from "@/hooks/helpers/useArmies";
import { useEntities } from "@/hooks/helpers/useEntities";
import { Headline } from "@/ui/elements/Headline";
import { ArmyChip } from "./ArmyChip";

type EntityArmyTableProps = {
  structureEntityId: bigint | undefined;
};

export const EntitiesArmyTable = () => {
  const { playerStructures } = useEntities();

  return playerStructures().map((entity: any) => {
    return (
      <div key={entity.entity_id} className="p-2">
        <Headline className="my-3">{entity.name}</Headline>
        <div className="grid grid-cols-1 gap-4">
          <EntityArmyTable structureEntityId={entity.entity_id} />
        </div>
      </div>
    );
  });
};

const EntityArmyTable = ({ structureEntityId }: EntityArmyTableProps) => {
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
