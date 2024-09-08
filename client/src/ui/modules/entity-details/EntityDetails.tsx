import { BuildingEntityDetails } from "./BuildingEntityDetails";
import { CombatEntityDetails } from "./CombatEntityDetails";
import { useQuery } from "@/hooks/helpers/useQuery";

export const EntityDetails = () => {
  const { isMapView } = useQuery();
  return <div className="h-full">{isMapView ? <CombatEntityDetails /> : <BuildingEntityDetails />}</div>;
};
