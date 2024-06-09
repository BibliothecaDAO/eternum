import { ArmyChip } from "./ArmyChip";
import { ArmyAndName, useEntityArmies } from "@/hooks/helpers/useArmies";
import { useEntities } from "@/hooks/helpers/useEntities";
import { Headline } from "@/ui/elements/Headline";

type EntityArmyTableProps = {
  entityId: bigint | undefined;
};

export const EntityArmyTable = ({ entityId }: EntityArmyTableProps) => {
  if (!entityId) {
    return <div>Entity not found</div>;
  }
  const { entityArmies } = useEntityArmies({ entity_id: entityId });
  const armyElements = () => {
    return entityArmies.map((army: ArmyAndName) => {
      return <ArmyChip key={army.army_id} army={army} />;
    });
  };

  return <div className="flex flex-col gap-4">{armyElements()}</div>;
};

export const EntitiesArmyTable = () => {
  const { playerStructures } = useEntities();

  return playerStructures().map((entity: any) => {
    return (
      <div className="p-2">
        <Headline className="my-3">{entity.name}</Headline>
        <EntityArmyTable entityId={entity.entity_id} />
      </div>
    );
  });
};
