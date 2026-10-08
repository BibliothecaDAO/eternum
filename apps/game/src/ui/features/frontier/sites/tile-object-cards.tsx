import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { TileOccupier } from "@bibliothecadao/types";
import { useMemo } from "react";

import { DEPTH_ART } from "../depth-art";
import { Sheet } from "@/ui/design-system/kit/sheet";

/** The map tile the player tapped, when it holds a spire. */
export const useSelectedTileObject = (): { kind: "spire"; tile: TileSpatialRenderable } | null => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => (selectedHex ? [selectedHex] : []), [selectedHex]);
  const [tile] = useWorldSpatialTiles(hexes);
  if (!isMapView || !tile) return null;
  if (tile.occupierType === TileOccupier.Spire) return { kind: "spire", tile };
  return null;
};

/** A spire, the way between the surface and the depth below: its portal, and one look at the other layer. */
export const SpireCard = ({ onClose }: { onClose: () => void }) => {
  const mapLayer = useUIStore((state) => state.mapLayer);
  const setMapLayer = useUIStore((state) => state.setMapLayer);
  return (
    <Sheet label="Spire" onClose={onClose}>
      <header className="flex items-center gap-3">
        <img src={DEPTH_ART[1]} alt="" className="size-24 shrink-0 object-contain" />
        <h2 className="frontier-title">Spire</h2>
      </header>
      <button
        type="button"
        aria-label={mapLayer ? "Look at the surface" : "Look at the depth"}
        onClick={() => setMapLayer(!mapLayer)}
        className="frontier-primary"
      >
        Look
      </button>
    </Sheet>
  );
};
