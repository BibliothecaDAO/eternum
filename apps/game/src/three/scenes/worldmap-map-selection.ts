import { attachMapSelectionPositions } from "@/hooks/store/map-selection";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";

/**
 * Lends the map's projection to the selection (map-selection.ts): a selected army or structure is shown where the
 * projection has it now, again on every change the projection publishes (a move, an explore, a Frontier realm raised
 * on its next day's site, a removal or a rollback). The returned function takes the positions back.
 */
export function bindMapSelection(projection: Pick<WorldSpatialProjection, "getArmy" | "getStructure" | "subscribe">) {
  const refresh = () => useUIStore.getState().refreshMapSelection();
  const detach = attachMapSelectionPositions({
    army: (entityId) => projection.getArmy(entityId)?.hexCoords,
    structure: (entityId) => projection.getStructure(entityId)?.hexCoords,
  });
  const unsubscribe = projection.subscribe(refresh);
  refresh();
  return () => {
    unsubscribe();
    detach();
    refresh();
  };
}
