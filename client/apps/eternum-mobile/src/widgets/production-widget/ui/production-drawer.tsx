import { RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { LaborBuilding } from "../model/types";
import { LaborProductionDrawer } from "./labor-production-drawer";
import { ResourcesProductionDrawer } from "./resources-production-drawer";

type ProductionDrawerProps = {
  building: LaborBuilding;
  realm: RealmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ProductionDrawer = ({ building, realm, open, onOpenChange }: ProductionDrawerProps) => {
  const isLaborMode = building.produced.resource === ResourcesIds.Labor;

  if (!realm) return null;
  if (isLaborMode) {
    return <LaborProductionDrawer realm={realm} open={open} onOpenChange={onOpenChange} building={building} />;
  }
  return <ResourcesProductionDrawer building={building} realm={realm} open={open} onOpenChange={onOpenChange} />;
};
