import { useMemo } from "react";
import { useLocation } from "wouter";
import { BuildingEntityDetails } from "./BuildingEntityDetails";
import { CombatEntityDetails } from "./CombatEntityDetails";

export const EntityDetails = () => {
  const [location, _] = useLocation();
  const isWorldView = useMemo(() => {
    return location === "/map";
  }, [location]);
  return <div>{isWorldView ? <CombatEntityDetails /> : <BuildingEntityDetails />}</div>;
};
