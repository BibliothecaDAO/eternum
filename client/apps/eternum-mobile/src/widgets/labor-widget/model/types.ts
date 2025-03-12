import { ResourcesIds } from "@bibliothecadao/eternum";

export interface ResourceAmount {
  resourceId: ResourcesIds;
  amount: number;
}

export interface LaborBuilding {
  id: string;
  resourceId: ResourcesIds;
  productionTimeLeft: number; // in seconds
  isActive: boolean;
  outputAmount: number;
  population: number;
  hasLaborMode: boolean;
  // Current input amounts
  inputs: ResourceAmount[];
  laborInputs: ResourceAmount[];
  // Fixed consumption rates per second
  consumptionRates: ResourceAmount[];
  laborConsumptionRates: ResourceAmount[];
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
