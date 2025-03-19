import { RealmInfo, ResourcesIds } from "@bibliothecadao/eternum";
import { useState } from "react";
import { LaborProductionDrawer } from "./labor-production-drawer";
import { ResourcesProductionDrawer } from "./resources-production-drawer";

type ProductionDrawerProps = {
  selectedResource: number;
  realm: RealmInfo;
};

export const ProductionDrawer = ({ selectedResource, realm }: ProductionDrawerProps) => {
  const isLaborMode = selectedResource === ResourcesIds.Labor;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  if (isLaborMode) {
    return (
      <LaborProductionDrawer
        selectedResource={selectedResource}
        realm={realm}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />
    );
  }

  return (
    <ResourcesProductionDrawer
      selectedResource={selectedResource}
      realm={realm}
      open={isDrawerOpen}
      onOpenChange={setIsDrawerOpen}
    />
  );
};
