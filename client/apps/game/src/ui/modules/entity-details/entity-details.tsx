import { BuildingEntityDetails } from "@/ui/modules/entity-details/building-entity-details";

export const EntityDetails = ({ className }: { className?: string }) => {
  return (
    <div className={`h-full ${className}`}>
      <BuildingEntityDetails />
    </div>
  );
};
