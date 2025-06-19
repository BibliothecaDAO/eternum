import { ArmyList } from "./components/army-list";
import { EntitiesArmyTable } from "./components/entities-army-table";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ID } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";

export const Military = ({ entityId, className }: { entityId: ID | undefined; className?: string }) => {
  const {
    setup: { components },
  } = useDojo();

  const { isMapView } = useQuery();
  const structure = useComponentValue(components.Structure, getEntityIdFromKeys([BigInt(entityId || 0)]));

  return (
    <div className={`relative ${className}`}>
      {isMapView ? <EntitiesArmyTable /> : structure && <ArmyList structure={structure} />}
    </div>
  );
};
