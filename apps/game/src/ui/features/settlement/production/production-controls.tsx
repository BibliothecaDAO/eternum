import { RealmInfo } from "@bibliothecadao/types";
import { useState } from "react";
import type { RunSizing } from "./production-run";
import { ResourceProductionControls } from "./resource-production-controls";

type ProductionControlsProps = { selectedResource: number; realm: RealmInfo; compact?: boolean };

/**
 * A realm's production form for one output. What it holds (the recipe chosen, the output or input budget typed) belongs
 * to that realm and output: choosing another resource or realm starts a fresh form, so a budget typed for one recipe's
 * input never sizes another that does not burn it. Every caller gets that scope from here.
 */
export const ProductionControls = (props: ProductionControlsProps) => (
  <ProductionForm key={`${props.realm.entityId}:${props.selectedResource}`} {...props} />
);

const ProductionForm = ({ selectedResource, realm, compact = false }: ProductionControlsProps) => {
  const [sizing, setSizing] = useState<RunSizing>({ by: "output", amount: 1 });

  return (
    <ResourceProductionControls
      compact={compact}
      selectedResource={selectedResource}
      sizing={sizing}
      setSizing={setSizing}
      realm={realm}
    />
  );
};
