import { RealmInfo, ResourcesIds } from "@bibliothecadao/eternum";
import { LaborProductionDrawer } from "./labor-production-drawer";
import { ResourcesProductionDrawer } from "./resources-production-drawer";

type ProductionDrawerProps = {
  selectedResource: number;
  realm: RealmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ProductionDrawer = ({ selectedResource, realm, open, onOpenChange }: ProductionDrawerProps) => {
  const isLaborMode = selectedResource === ResourcesIds.Labor;

  if (!realm) return null;
  if (isLaborMode) {
    console.log("realm labor", realm);
    return <LaborProductionDrawer realm={realm} open={open} onOpenChange={onOpenChange} />;
  }
  return (
    <ResourcesProductionDrawer
      selectedResource={selectedResource}
      realm={realm}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
};
