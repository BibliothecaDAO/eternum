import { useMemo } from "react";
import { useLocation } from "wouter";
import { CombatEntityDetails } from "./CombatEntityDetails";
import { BuildingEntityDetails } from "./BuildingEntityDetails";

export const EntityDetails = () => {
  const [location, _] = useLocation();
  const isWorldView = useMemo(() => {
    return location === "/map";
  }, [location]);
  return <div>{isWorldView ? <CombatEntityDetails /> : <BuildingEntityDetails />}</div>;
};
