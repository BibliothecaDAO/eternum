import { reloadBuildOrders, useBuildOrderFailure } from "@/hooks/use-build-orders";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";

/**
 * Why the account's orders could not be read or saved, with Try again: said wherever the game shows the order's steps
 * (the desktop's Build order panel, the phone's Suggested actions), never left to look like the game's order.
 */
export const BuildOrderFailure = () => {
  const failure = useBuildOrderFailure();
  return failure ? <HudNotice tone="bad" line={failure} retry={reloadBuildOrders} /> : null;
};
