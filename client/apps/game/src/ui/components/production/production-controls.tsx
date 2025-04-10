import { RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
import { LaborProductionControls } from "./labor-production-controls";
import { ResourceProductionControls } from "./resource-production-controls";

export const ProductionControls = ({ selectedResource, realm }: { selectedResource: number; realm: RealmInfo }) => {
  const isLaborMode = selectedResource === ResourcesIds.Labor;

  const [useRawResources, setUseRawResources] = useState(true);
  const [productionAmount, setProductionAmount] = useState(1);
  const [ticks, setTicks] = useState<number | undefined>();

  if (isLaborMode) {
    return <LaborProductionControls realm={realm} />;
  }

  return (
    <ResourceProductionControls
      selectedResource={selectedResource}
      useRawResources={useRawResources}
      setUseRawResources={setUseRawResources}
      productionAmount={productionAmount}
      setProductionAmount={setProductionAmount}
      realm={realm}
      ticks={ticks}
      setTicks={setTicks}
    />
  );
};
