import { Building, ResourcesIds } from "@bibliothecadao/eternum";

export interface ResourceAmount {
  resourceId: ResourcesIds;
  amount: number;
}

export interface LaborBuilding extends Building {
  isActive: boolean;
  productionTimeLeft: number;
}

export interface ResourceBalance {
  resourceId: ResourcesIds;
  balance: number;
}

export interface LaborBuildingProps {
  building: LaborBuilding;
}
