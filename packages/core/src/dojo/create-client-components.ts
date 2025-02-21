import { overridableComponent } from "@dojoengine/recs";
import { ContractComponents } from "./contract-components";

export type ClientComponents = ReturnType<typeof createClientComponents>;

export function createClientComponents({ contractComponents }: { contractComponents: ContractComponents }) {
  return {
    ...contractComponents,
    ExplorerTroops: overridableComponent(contractComponents.ExplorerTroops),
    Building: overridableComponent(contractComponents.Building),
    Position: overridableComponent(contractComponents.Position),
    Tile: overridableComponent(contractComponents.Tile),
    Population: overridableComponent(contractComponents.Population),
    Resource: overridableComponent(contractComponents.Resource),
    BuildingQuantityv2: overridableComponent(contractComponents.BuildingQuantityv2),
    Structure: overridableComponent(contractComponents.Structure),
  };
}
