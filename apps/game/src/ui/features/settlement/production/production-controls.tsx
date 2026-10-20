import { isMilitaryResource } from "@bibliothecadao/eternum";
import { RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
import type { RunSizing } from "./production-run";
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
  const [sizing, setSizing] = useState<RunSizing>({ by: "output", amount: 1 });

  if (!bonuses) return <p>Loading production…</p>;
  // The bonus the chain adds to this resource's output: labor's for labor, troops' for troops, else resources'.
  const bonusPercent =
    selectedResource === ResourcesIds.Labor
      ? bonuses.labor
      : isMilitaryResource(selectedResource)
        ? bonuses.troops
        : bonuses.production;

  return (
    <ResourceProductionControls
      compact={compact}
      selectedResource={selectedResource}
      useRawResources={useRawResources}
      setUseRawResources={setUseRawResources}
      sizing={sizing}
      setSizing={setSizing}
      realm={realm}
      bonusPercent={bonusPercent}
    />
  );
};
