import { overridableComponent } from "@dojoengine/recs";
import { SetupNetworkResult } from "./setupNetwork";

export type ClientComponents = ReturnType<typeof createClientComponents>;

export function createClientComponents({ contractComponents }: SetupNetworkResult) {
  return {
    ...contractComponents,
    Building: overridableComponent(contractComponents.Building),
    Position: overridableComponent(contractComponents.Position),
    Stamina: overridableComponent(contractComponents.Stamina),
    Tile: overridableComponent(contractComponents.Tile),
    Population: overridableComponent(contractComponents.Population),
    Resource: overridableComponent(contractComponents.Resource),
    Weight: overridableComponent(contractComponents.Weight),
    OwnedResourcesTracker: overridableComponent(contractComponents.OwnedResourcesTracker),
    Army: overridableComponent(contractComponents.Army),
    BuildingQuantityv2: overridableComponent(contractComponents.BuildingQuantityv2),
    Structure: overridableComponent(contractComponents.Structure),
    ArrivalTime: overridableComponent(contractComponents.ArrivalTime),
  };
}
