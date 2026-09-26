import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { requestChestOpening } from "@/three/scenes/worldmap-chest-open-request";
import { useAdjacentOwnExplorer } from "@/ui/features/military/chest/use-adjacent-own-explorer";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { TileOccupier } from "@bibliothecadao/types";
import { useMemo } from "react";

import { DEPTH_ART } from "../depth-art";
import { FrontierSheet } from "../frontier-sheet";

const CHEST_ART = "/image-icons/ui-chest.png";

/** The map tile the player tapped, when it holds a loose chest or a spire. */
export const useSelectedTileObject = (): { kind: "chest" | "spire"; tile: TileSpatialRenderable } | null => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => (selectedHex ? [selectedHex] : []), [selectedHex]);
  const [tile] = useWorldSpatialTiles(hexes);
  if (!isMapView || !tile) return null;
  if (tile.occupierType === TileOccupier.Chest) return { kind: "chest", tile };
  if (tile.occupierType === TileOccupier.Spire) return { kind: "spire", tile };
  return null;
};

/** A loose chest: its art and one Open, for the player's army standing beside it; the moment plays on the map. */
export const ChestCard = ({ tile, onClose }: { tile: TileSpatialRenderable; onClose: () => void }) => {
  const hex = { col: tile.hexCoords.col, row: tile.hexCoords.row };
  const explorerId = useAdjacentOwnExplorer(hex);
  const open = () => {
    if (explorerId === null) return;
    requestChestOpening({ explorerId, hex });
    onClose();
  };
  return (
    <FrontierSheet label="Chest" onClose={onClose}>
      <header className="flex items-center gap-3">
        <img src={CHEST_ART} alt="" className="size-24 shrink-0 object-contain" />
        <h2 className="frontier-title">Chest</h2>
      </header>
      <button type="button" disabled={explorerId === null} onClick={open} className="frontier-primary">
        Open
      </button>
    </FrontierSheet>
  );
};

/** A spire, the way between the surface and the depth below: its portal, and one look at the other layer. */
export const SpireCard = ({ onClose }: { onClose: () => void }) => {
  const mapLayer = useUIStore((state) => state.mapLayer);
  const setMapLayer = useUIStore((state) => state.setMapLayer);
  return (
    <FrontierSheet label="Spire" onClose={onClose}>
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
    </FrontierSheet>
  );
};
