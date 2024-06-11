import { overridableComponent } from "@dojoengine/recs";
import { SetupNetworkResult } from "./setupNetwork";
import { Position } from "@/ui/elements/BaseThreeTooltip";

export type ClientComponents = ReturnType<typeof createClientComponents>;

export function createClientComponents({ contractComponents }: SetupNetworkResult) {
  return {
    ...contractComponents,
    Building: overridableComponent(contractComponents.Building),
    Position: overridableComponent(contractComponents.Position),
  };
}
