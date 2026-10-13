import { useUIStore } from "@/hooks/store/use-ui-store";
import { pinsOrder } from "@/three/scenes/worldmap-order-request";
import { FELT_CENTER } from "@/ui/config";
import { ActionPaths } from "@bibliothecadao/eternum";
import { getNeighborHexes } from "@bibliothecadao/types";

/**
 * The tile beside the site the selected army can explore or move to in the fewest steps, as a normalized tile for the
 * order; null when it is in reach already or no such order leads there (a tile another of the player's armies holds
 * is no way in).
 */
export const useApproachTile = (
  siteTile: { col: number; row: number },
  wanted: boolean,
): { col: number; row: number } | null => {
  const actionPaths = useUIStore((state) => state.entityActions.actionPaths);
  if (!wanted) return null;
  let best: { col: number; row: number; steps: number } | null = null;
  for (const neighbor of getNeighborHexes(siteTile.col, siteTile.row)) {
    const path = actionPaths.get(ActionPaths.posKey(neighbor));
    if (!path || !pinsOrder(path) || (best && path.length >= best.steps)) continue;
    best = { col: neighbor.col - FELT_CENTER(), row: neighbor.row - FELT_CENTER(), steps: path.length };
  }
  return best && { col: best.col, row: best.row };
};
