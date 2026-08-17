import { overridableComponent } from "@dojoengine/recs";
import { ContractComponents } from "./contract-components";

export type ClientComponents = ReturnType<typeof createClientComponents>;

export function createClientComponents({ contractComponents }: { contractComponents: ContractComponents }) {
  return {
    ...contractComponents,
    ExplorerTroops: overridableComponent(contractComponents.ExplorerTroops),
    Building: overridableComponent(contractComponents.Building),
    Resource: overridableComponent(contractComponents.Resource),
    StructureBuildings: overridableComponent(contractComponents.StructureBuildings),
  };
}
