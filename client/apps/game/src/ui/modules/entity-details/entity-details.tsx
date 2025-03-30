import { BuildingEntityDetails } from "@/ui/modules/entity-details/building-entity-details";
import { useQuery } from "@bibliothecadao/react";

export const EntityDetails = ({ className }: { className?: string }) => {
  const { isMapView } = useQuery();

  return (
    <div className={`h-full ${className}`}>
      {isMapView ? (
        <div className="h-full flex items-center justify-center text-center text-sm">
          <span>WIP - Select an entity to view details</span>
        </div>
      ) : (
        <BuildingEntityDetails />
      )}
    </div>
  );
};
