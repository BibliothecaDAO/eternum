import { overridableComponent } from "@dojoengine/recs";
import { ContractComponents } from "./contract-components";

export type ClientComponents = ReturnType<typeof createClientComponents>;

export function createClientComponents({ contractComponents }: { contractComponents: ContractComponents }) {
  return {
    ...contractComponents,
    ExplorerTroops: overridableComponent(contractComponents.ExplorerTroops),
    Building: overridableComponent(contractComponents.Building),
    Tile: overridableComponent(contractComponents.Tile),
    Resource: overridableComponent(contractComponents.Resource),
    Structure: overridableComponent(contractComponents.Structure),
    StructureBuildings: overridableComponent(contractComponents.StructureBuildings),
    ResourceArrival: overridableComponent(contractComponents.ResourceArrival),
  };
}
