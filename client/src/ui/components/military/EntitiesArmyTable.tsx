import { ArmyChip } from "./ArmyChip";
import { ArmyAndName, useEntityArmies } from "@/hooks/helpers/useArmies";
import { useEntities } from "@/hooks/helpers/useEntities";

type EntityArmyTableProps = {
  entityId: bigint | undefined;
};

export const EntityArmyTable = ({ entityId }: EntityArmyTableProps) => {
  if (!entityId) {
    return <div>Entity not found</div>;
  }
  const { entityArmies } = useEntityArmies({ entity_id: entityId });
  const armyElements = () => {
    return entityArmies().map((army: ArmyAndName) => {
      return <ArmyChip key={army.army_id} army={army} />;
    });
  };

  return <div>{armyElements()}</div>;
};

export const EntitiesArmyTable = () => {
  const { playerRealms } = useEntities();

  return playerRealms().map((entity: any) => {
    return (
      <div>
        <div>{entity.name}</div>
        <EntityArmyTable entityId={entity.entity_id} />
      </div>
    );
  });
};
