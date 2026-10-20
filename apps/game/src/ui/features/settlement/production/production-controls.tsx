import { isMilitaryResource } from "@bibliothecadao/eternum";
import { RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
import type { RunSizing } from "./production-run";
import { useProductionBonuses } from "./use-production-bonuses";
import { ResourceProductionControls } from "./resource-production-controls";

type ProductionControlsProps = { selectedResource: number; realm: RealmInfo; compact?: boolean };

/**
 * A realm's production form for one output. What it holds (the recipe chosen, the output or input budget typed) belongs
 * to that realm and output: choosing another resource or realm starts a fresh form, so a budget typed for one recipe's
 * input never sizes another recipe that does not burn it. Every caller gets that scope from here.
 */
export const ProductionControls = (props: ProductionControlsProps) => (
  <ProductionForm key={`${props.realm.entityId}:${props.selectedResource}`} {...props} />
);

const ProductionForm = ({ selectedResource, realm, compact = false }: ProductionControlsProps) => {
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
