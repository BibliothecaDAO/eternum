import { overridableComponent } from "@latticexyz/recs";
import { SetupNetworkResult } from "./setupNetwork";

export type ClientComponents = ReturnType<typeof createClientComponents>;

export function createClientComponents({ contractComponents }: SetupNetworkResult) {
  return {
    ...contractComponents,
    Position: overridableComponent(contractComponents.Position),
    Trade: overridableComponent(contractComponents.Trade),
    Status: overridableComponent(contractComponents.Status),
    Resource: overridableComponent(contractComponents.Resource),
    Labor: overridableComponent(contractComponents.Labor),
    Road: overridableComponent(contractComponents.Road),
    Inventory: overridableComponent(contractComponents.Inventory),
    ResourceChest: overridableComponent(contractComponents.ResourceChest),
    DetachedResource: overridableComponent(contractComponents.DetachedResource),
  };
}
