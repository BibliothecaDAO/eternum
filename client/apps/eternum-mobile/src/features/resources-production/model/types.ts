import { ResourcesIds } from "@bibliothecadao/types";

export interface ProductionBuilding {
  category: string;
  produced: {
    resource: number;
  };
}

export interface ProductionResource {
  resource: number;
  balance: number;
  production: number;
  buildings: ProductionBuilding[];
  isLabor: boolean;
}

export interface LaborConfig {
  laborProductionPerResource: number;
  laborBurnPerResourceOutput: number;
  laborRatePerTick: number;
  resourceOutputPerInputResources: number;
  inputResources: { resource: ResourcesIds; amount: number }[];
}

export interface LaborProductionCalldata {
  entity_id: number;
  resource_types: number[];
  resource_amounts: number[];
  signer: string;
}

export interface ResourceProductionCalldata {
  entity_id: number;
  resource_type: number;
  amount: number;
  signer: string;
}

export interface SelectedResource {
  id: number;
  amount: number;
}

export interface ProductionStatus {
  isActive: boolean;
  resourceType: number;
  amount: number;
  startTime: number;
}
