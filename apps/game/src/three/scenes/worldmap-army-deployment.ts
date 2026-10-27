import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { ActionPaths, ActionType, type ActionPath } from "@bibliothecadao/eternum";
import type { HexPosition } from "@bibliothecadao/types";

const DEPLOY_TOOLTIP = "Deploy an army here. Right-click.";

export function resolveSpawnActionPath(
  hex: HexPosition | null,
  actionPaths: Map<string, ActionPath[]>,
): ActionPath[] | null {
  if (!hex || !canIssueOrders()) return null;
  const path = actionPaths.get(ActionPaths.posKey(hex, true));
  return path && ActionPaths.getActionType(path) === ActionType.CreateArmy ? path : null;
}

export function showArmyDeploymentTooltip(point: { x: number; y: number } | null): void {
  const store = useTooltipStore.getState();
  if (!point || !canIssueOrders()) {
    if (store.tooltip?.content === DEPLOY_TOOLTIP) store.setTooltip(null);
    return;
  }
  store.setTooltip({
    content: DEPLOY_TOOLTIP,
    fixed: { x: Math.max(8, Math.min(point.x + 12, window.innerWidth - 280)), y: Math.max(56, point.y - 42) },
  });
}
