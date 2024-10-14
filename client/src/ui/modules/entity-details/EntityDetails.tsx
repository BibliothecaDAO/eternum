import { useQuery } from "@/hooks/helpers/useQuery";
import { BuildingEntityDetails } from "./BuildingEntityDetails";
import { CombatEntityDetails } from "./CombatEntityDetails";

export const EntityDetails = ({ className }: { className?: string }) => {
  const { isMapView } = useQuery();
  return <div className={`h-full ${className}`}>{isMapView ? <CombatEntityDetails /> : <BuildingEntityDetails />}</div>;
};
