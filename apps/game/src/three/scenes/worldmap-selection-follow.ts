import { useUIStore } from "@/hooks/store/use-ui-store";
import { activeMapLayer } from "@/three/map-layer";
import type { WorldSpatialHex, WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import type { HexPosition } from "@bibliothecadao/types";

interface SelectionFollowInput {
  projection: Pick<WorldSpatialProjection, "subscribeStructures">;
  /** Selects a contract hex the way the map does when it moves a selection without a click. */
  moveSelection: (hex: HexPosition) => void;
}

/**
 * A structure that moves while selected (a Frontier realm raised on its next day's site) takes the selection with it,
 * so the selected hex, its ring, the tile panel and the ownership rings keep naming the same structure.
 */
export function bindSelectionToMovingStructures({ projection, moveSelection }: SelectionFollowInput): () => void {
  return projection.subscribeStructures((changes) => {
    const selected = useUIStore.getState().selectedHex;
    if (!selected) return;
    const alt = activeMapLayer();
    for (const { previous, current } of changes) {
      if (!previous || !current || previous.entityId === null || current.entityId !== previous.entityId) continue;
      if (!isSelected(previous.hexCoords, selected, alt) || isSelected(current.hexCoords, selected, alt)) continue;
      if (current.hexCoords.alt !== alt) continue;
      moveSelection({ col: current.hexCoords.col, row: current.hexCoords.row });
      return;
    }
  });
}

const isSelected = (hex: WorldSpatialHex, selected: HexPosition, alt: boolean): boolean =>
  hex.alt === alt && hex.col === selected.col && hex.row === selected.row;
