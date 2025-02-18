import { EntityArmyList } from "@/ui/components/military/army-list";
import { EntitiesArmyTable } from "@/ui/components/military/entities-army-table";
import { ContractAddress, getStructure, ID } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { useMemo } from "react";

export const Military = ({ entityId, className }: { entityId: ID | undefined; className?: string }) => {
  const {
    account: {
      account: { address },
    },
    setup: { components },
  } = useDojo();

  const { isMapView } = useQuery();
  const selectedStructure = useMemo(
    () => (entityId ? getStructure(entityId, ContractAddress(address), components) : undefined),
    [entityId, address, components],
  );

  return (
    <div className={`relative ${className}`}>
      {isMapView ? <EntitiesArmyTable /> : selectedStructure && <EntityArmyList structure={selectedStructure} />}
    </div>
  );
};
