import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { EntityArmyList } from "@/ui/components/military/ArmyList";
import { EntitiesArmyTable } from "@/ui/components/military/EntitiesArmyTable";
import { ID } from "@bibliothecadao/eternum";

export const Military = ({ entityId, className }: { entityId: ID | undefined; className?: string }) => {
  const { isMapView } = useQuery();

  const { playerStructures } = useEntities();

  const selectedStructure = playerStructures().find((structure) => structure.entity_id === entityId);

  return (
    <div className={`relative ${className}`}>
      {isMapView ? <EntitiesArmyTable /> : selectedStructure && <EntityArmyList structure={selectedStructure} />}
    </div>
  );
};
