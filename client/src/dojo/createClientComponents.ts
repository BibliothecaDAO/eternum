import { overridableComponent } from "@latticexyz/recs";
import { SetupNetworkResult } from "./setupNetwork";

export type ClientComponents = ReturnType<typeof createClientComponents>;

export function createClientComponents({ contractComponents }: SetupNetworkResult) {
  return {
    ...contractComponents,
    Position: overridableComponent(contractComponents.Position),
    Trade: overridableComponent(contractComponents.Trade),
    Status: overridableComponent(contractComponents.Status),
    FungibleEntities: overridableComponent(contractComponents.FungibleEntities),
    Resource: overridableComponent(contractComponents.Resource),
    Labor: overridableComponent(contractComponents.Labor),
    OrderResource: overridableComponent(contractComponents.OrderResource),
    Road: overridableComponent(contractComponents.Road),
  };
}
