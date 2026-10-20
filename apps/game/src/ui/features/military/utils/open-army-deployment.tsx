import { getGameModeId } from "@/config/game-modes";
import {
  usePopoverStore,
  type PopoverMapClick,
  type SurfaceAnchor,
  type SurfacePlacement,
} from "@/hooks/store/use-popover-store";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { hudFor } from "@/ui/layouts/hud-for";
import { canIssueOrders } from "@/utils/can-issue-orders";
import type { Direction } from "@bibliothecadao/types";
import { ArmyDeploymentPicker } from "../components/army-deployment-picker";
import type { TroopStack } from "../components/unified-army-creation-modal/types";

export interface ArmyDeploymentTarget {
  structureId: number;
  isExplorer: boolean;
  direction?: Direction;
  initialGuardSlot?: number;
  /** The troop stack the order named (Next up's "1,000 troops on hand"): the form opens on that troop at that count. */
  troops?: TroopStack;
}

/** Where on screen an order to deploy was given: the tile or the slot the shared HUD hangs its picker from. */
interface ArmyDeploymentPlace {
  anchor: SurfaceAnchor;
  placement?: SurfacePlacement;
  mapClick?: PopoverMapClick;
}

export const ARMY_DEPLOYMENT_SURFACE_ID = "army-deployment";

/**
 * The one way to open "deploy an army from this structure", for every order that asks for it: a tile beside the realm
 * on the map, the realm's map menu, a guard slot, Frontier's dock. The game's HUD decides the surface here, once. The
 * shared HUD hangs its picker where the order was given, or opens its Military workspace when the order has no place
 * on screen; a Frontier game deploys only from its own sheet, aimed at the tile the order names.
 */
export function openArmyDeployment(target: ArmyDeploymentTarget, place?: ArmyDeploymentPlace) {
  if (!canIssueOrders()) return;
  if (place && hudFor(getGameModeId(), true) === "shared") {
    openArmyDeploymentPicker(target, place);
    return;
  }
  const ui = useUIStore.getState();
  ui.setPendingMilitaryAction(target);
  ui.setLeftNavigationView(LeftView.MilitaryView);
}

function openArmyDeploymentPicker(target: ArmyDeploymentTarget, place: ArmyDeploymentPlace) {
  useTooltipStore.getState().setTooltip(null);
  usePopoverStore.getState().openSurface({
    id: ARMY_DEPLOYMENT_SURFACE_ID,
    content: (
      <ArmyDeploymentPicker key={`${target.structureId}-${target.isExplorer}-${target.initialGuardSlot}`} {...target} />
    ),
    ...place,
  });
}
