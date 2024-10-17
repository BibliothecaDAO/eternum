import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { EntityArmyList } from "@/ui/components/military/ArmyList";
import { EntitiesArmyTable } from "@/ui/components/military/EntitiesArmyTable";
import { ID } from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const Military = ({ entityId, className }: { entityId: ID | undefined; className?: string }) => {
  const { isMapView } = useQuery();

  const { playerStructures } = useEntities();

  const selectedStructure = useMemo(() => {
    return playerStructures().find((structure) => structure.entity_id === entityId);
  }, [playerStructures, entityId]);

  return (
    <div className={`relative ${className}`}>
      {isMapView ? <EntitiesArmyTable /> : selectedStructure && <EntityArmyList structure={selectedStructure} />}
    </div>
  );
};
