import { useUIStore } from "@/hooks/store/use-ui-store";
import { publishMapSelection } from "@/observability/map-selection";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";

import { getLiveWorldmapEntityActions } from "./worldmap-interaction-state";

/**
 * Publishes the selected army to the page's map selection report (observability/map-selection): its id, the hex the
 * projection has it on, and how many tiles it is offered an order on. It follows every change of the selection or its
 * orders, and every army the projection moves.
 */
export function reportSelectedArmy(projection: Pick<WorldSpatialProjection, "getArmy" | "subscribe">): () => void {
  const report = () => {
    const { selectedEntityId, actionPaths } = getLiveWorldmapEntityActions();
    const army = selectedEntityId == null ? undefined : projection.getArmy(selectedEntityId);
    publishMapSelection({
      army:
        selectedEntityId != null && army
          ? {
              id: selectedEntityId,
              hex: { col: army.hexCoords.col, row: army.hexCoords.row },
              orders: actionPaths.size,
            }
          : null,
    });
  };
  const stops = [
    useUIStore.subscribe((state) => state.entityActions, report),
    projection.subscribe((changes) => {
      if (changes.some((change) => change.kind === "army")) report();
    }),
  ];
  report();
  return () => stops.forEach((stop) => stop());
}
