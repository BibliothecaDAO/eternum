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
  };
}
