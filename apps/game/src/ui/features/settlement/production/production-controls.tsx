import { isMilitaryResource } from "@bibliothecadao/eternum";
import { RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
import { useProductionBonuses } from "./use-production-bonuses";
import { ResourceProductionControls } from "./resource-production-controls";

export const ProductionControls = ({
  selectedResource,
  realm,
  compact = false,
}: {
  selectedResource: number;
  realm: RealmInfo;
  compact?: boolean;
}) => {
  const bonuses = useProductionBonuses(realm.entityId);
  const [useRawResources, setUseRawResources] = useState(true);
  const [productionAmount, setProductionAmount] = useState(1);
  const [ticks, setTicks] = useState<number | undefined>();

  if (!bonuses) return <p>Loading production…</p>;
  const { laborBonus, productionBonus, troopsBonus } = bonuses;
  const resourceProductionBonus =
    selectedResource === ResourcesIds.Labor
      ? laborBonus
      : isMilitaryResource(selectedResource)
        ? troopsBonus
        : productionBonus;

  return (
    <ResourceProductionControls
      compact={compact}
      selectedResource={selectedResource}
      useRawResources={useRawResources}
      setUseRawResources={setUseRawResources}
      productionAmount={productionAmount}
      setProductionAmount={setProductionAmount}
      realm={realm}
      ticks={ticks}
      setTicks={setTicks}
      bonus={resourceProductionBonus}
    />
  );
};
