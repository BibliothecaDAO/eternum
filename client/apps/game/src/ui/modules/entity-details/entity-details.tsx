import { useUIStore } from "@/hooks/store/use-ui-store";
import { BuildingEntityDetails } from "@/ui/modules/entity-details/building-entity-details";
import { useQuery } from "@bibliothecadao/react";

export const EntityDetails = ({ className }: { className?: string }) => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  return (
    <div className={`h-full ${className}`}>
      {isMapView ? (
        <div className="h-full flex items-center justify-center text-center text-sm">
          selectedHex: {selectedHex?.col}, {selectedHex?.row}
        </div>
      ) : (
        <BuildingEntityDetails />
      )}
    </div>
  );
};
