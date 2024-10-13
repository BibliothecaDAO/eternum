import { useDojo } from "@/hooks/context/DojoContext";
import { getPlayerStructures } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { EntityArmyList } from "@/ui/components/military/ArmyList";
import { EntitiesArmyTable } from "@/ui/components/military/EntitiesArmyTable";
import { ContractAddress, ID } from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const Military = ({ entityId, className }: { entityId: ID | undefined; className?: string }) => {
  const {
    account: { account },
  } = useDojo();

  const { isMapView } = useQuery();
  const getStructures = getPlayerStructures();

  const selectedStructure = useMemo(() => {
    return getStructures(ContractAddress(account.address)).find((structure) => structure.entity_id === entityId);
  }, [getStructures, entityId]);

  return (
    <div className={`relative ${className}`}>
      {isMapView ? <EntitiesArmyTable /> : selectedStructure && <EntityArmyList structure={selectedStructure} />}
    </div>
  );
};
