import { ResourcesIds } from "@bibliothecadao/eternum";

export interface LaborBuilding {
  id: string;
  resourceId: ResourcesIds;
  productionTimeLeft: number; // in seconds
  isActive: boolean;
  outputAmount: number;
  inputs: {
    resourceId: ResourcesIds;
    amount: number;
  }[];
  laborInputs: {
    resourceId: ResourcesIds;
    amount: number;
  }[];
}

export interface ResourceBalance {
  resourceId: ResourcesIds;
  balance: number;
}

export interface LaborBuildingProps {
  building: LaborBuilding;
  resourceBalances: ResourceBalance[];
  onStartProduction: (buildingId: string, mode: "raw" | "labor") => void;
  onPauseProduction: (buildingId: string) => void;
  onExtendProduction: (buildingId: string, mode: "raw" | "labor") => void;
}
