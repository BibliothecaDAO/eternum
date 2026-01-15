import { isMilitaryResource } from "@bibliothecadao/eternum";
import { RealmInfo } from "@bibliothecadao/types";
import { useState } from "react";
import { ResourceProductionControls } from "./resource-production-controls";

export const ProductionControls = ({
  selectedResource,
  realm,
  wonderBonus,
  productionBonus,
  troopsBonus,
}: {
  selectedResource: number;
  realm: RealmInfo;
  wonderBonus: number;
  productionBonus: number;
  troopsBonus: number;
}) => {
  const [useRawResources, setUseRawResources] = useState(true);
  const [productionAmount, setProductionAmount] = useState(1);
  const [ticks, setTicks] = useState<number | undefined>();

  const resourceProductionBonus = isMilitaryResource(selectedResource) ? troopsBonus : productionBonus;

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
