import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { TileOccupier } from "@bibliothecadao/types";
import { useMemo } from "react";

import { reachMark } from "../depth-art";

import { HudButton, HudSheet } from "@/ui/design-system/kit/hud-elements";

/** The selected loose map object; its card is mounted by Frontier on both HUD layouts. */
export const useSelectedTileObject = (): { kind: "spire" | "chest"; tile: TileSpatialRenderable } | null => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => (selectedHex ? [selectedHex] : []), [selectedHex]);
  const [tile] = useWorldSpatialTiles(hexes);
  if (!isMapView || !tile) return null;
  if (tile.occupierType === TileOccupier.Spire) return { kind: "spire", tile };
  if (tile.occupierType === TileOccupier.Chest) return { kind: "chest", tile };
  return null;
};

/** A spire, the way between the surface and the depth below: its portal, and one look at the other layer. */
export const SpireCard = ({ onClose }: { onClose: () => void }) => {
  const mapLayer = useUIStore((state) => state.mapLayer);
  const setMapLayer = useUIStore((state) => state.setMapLayer);
  return (
    <HudSheet label="Spire" onClose={onClose}>
      <SemanticIcon name={reachMark(1)} size={96} />
      <HudButton
        kind="primary"
        aria-label={mapLayer ? "Look at the surface" : "Look at the depth"}
        onClick={() => setMapLayer(!mapLayer)}
      >
        Look
      </HudButton>
    </HudSheet>
  );
};
