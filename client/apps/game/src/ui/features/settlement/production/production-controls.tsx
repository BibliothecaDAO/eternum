import { isMilitaryResource } from "@bibliothecadao/eternum";
import { RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
import { LaborProductionControls } from "./labor-production-controls";
import { ResourceProductionControls } from "./resource-production-controls";

export const ProductionControls = ({
  selectedResource,
  realm,
  wonderBonus,
  laborBonus,
  productionBonus,
  troopsBonus,
}: {
  selectedResource: number;
  realm: RealmInfo;
  wonderBonus: number;
  laborBonus: number;
  productionBonus: number;
  troopsBonus: number;
}) => {
  const isLaborMode = selectedResource === ResourcesIds.Labor;

  const [useRawResources, setUseRawResources] = useState(true);
  const [productionAmount, setProductionAmount] = useState(1);
  const [ticks, setTicks] = useState<number | undefined>();

  const resourceProductionBonus = isMilitaryResource(selectedResource) ? troopsBonus : productionBonus;

  if (isLaborMode) {
    return <LaborProductionControls realm={realm} bonus={laborBonus * wonderBonus} />;
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
      bonus={resourceProductionBonus * wonderBonus}
    />
  );
};
