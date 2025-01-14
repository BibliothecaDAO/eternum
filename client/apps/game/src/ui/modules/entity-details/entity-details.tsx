import { BuildingEntityDetails } from "@/ui/modules/entity-details/building-entity-details";
import { CombatEntityDetails } from "@/ui/modules/entity-details/combat-entity-details";
import { useQuery } from "@bibliothecadao/react";

export const EntityDetails = ({ className }: { className?: string }) => {
  const { isMapView } = useQuery();
  return <div className={`h-full ${className}`}>{isMapView ? <CombatEntityDetails /> : <BuildingEntityDetails />}</div>;
};
