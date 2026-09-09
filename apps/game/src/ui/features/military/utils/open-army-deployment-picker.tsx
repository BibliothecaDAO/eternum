import { usePopoverStore, type PopoverMapClick, type SurfaceAnchor } from "@/hooks/store/use-popover-store";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import type { Direction } from "@bibliothecadao/types";
import { ArmyDeploymentPicker } from "../components/army-deployment-picker";

export interface ArmyDeploymentTarget {
  structureId: number;
  isExplorer: boolean;
  direction?: Direction;
  initialGuardSlot?: number;
  maxDefenseSlots?: number;
}

export function openArmyDeploymentPicker(
  target: ArmyDeploymentTarget,
  anchor: SurfaceAnchor,
  mapClick?: PopoverMapClick,
) {
  if (!canIssueOrders()) return;
  useTooltipStore.getState().setTooltip(null);
  usePopoverStore.getState().openSurface({
    id: "army-deployment",
    content: (
      <ArmyDeploymentPicker key={`${target.structureId}-${target.isExplorer}-${target.initialGuardSlot}`} {...target} />
    ),
    anchor,
    mapClick,
  });
}
