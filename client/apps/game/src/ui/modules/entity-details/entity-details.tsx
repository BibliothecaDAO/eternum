import { BuildingEntityDetails } from "@/ui/modules/entity-details/building-entity-details";
import { HexEntityDetails } from "@/ui/modules/entity-details/hex-entity-details";
import { useQuery } from "@bibliothecadao/react";

export const EntityDetails = ({ className }: { className?: string }) => {
  const { isMapView } = useQuery();

  return <div className={`h-full ${className}`}>{isMapView ? <HexEntityDetails /> : <BuildingEntityDetails />}</div>;
};
