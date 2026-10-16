import { useSelectedTile } from "@/hooks/helpers/use-selected-tile";
import { iconUrl } from "@/ui/design-system/icon-meaning";
import type { ReactNode } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useTileAt, useStoredBiome } from "@/hooks/helpers/use-tile-at";
import { getStructureInfoFromTileOccupier } from "@bibliothecadao/eternum";
import { categoryPaintings } from "@/ui/design-system/painted/hud-art";
import { useSelectedTileDetails } from "../components/bottom-right-panel/bottom-right-panel";
import { HudPanel } from "./arena-hud-view";
export function SelectedTileSummaryView({
  title,
  description,
  art,
  details,
}: {
  title: string;
  description: string;
  art: string;
  details: ReactNode;
}) {
  return (
    <HudPanel title={title} className="tile-panel">
      <details>
        <summary data-notice>
          <img src={art} alt="" />
          {description}
        </summary>
        {details}
      </details>
    </HudPanel>
  );
}
export function SelectedTileSummary() {
  const selection = useSelectedTile();
  const hex = selection?.scene === "world" ? selection.hex : null;
  const layer = useUIStore((state) => state.mapLayer);
  const tile = useTileAt(hex?.col, hex?.row, layer);
  const biome = useStoredBiome(hex?.col, hex?.row, layer);
  const details = useSelectedTileDetails();
  if (!selection) return null;
  if (selection.scene === "local")
    return (
      <SelectedTileSummaryView
        title={`Realm tile · (${selection.hex.innerCol}, ${selection.hex.innerRow})`}
        description="Building details"
        art={iconUrl("build")}
        details={details}
      />
    );
  if (!hex) return null;
  const structure = tile && getStructureInfoFromTileOccupier(Number(tile.occupier_type));
  const category = structure ? categoryPaintings[structure.type] : null;
  return (
    <SelectedTileSummaryView
      title={`Tile · (${hex.col}, ${hex.row})`}
      description={`${biome ?? "Unexplored"}${category ? ` · ${category.name}` : ""}`}
      art={category?.art ?? iconUrl("explore")}
      details={details}
    />
  );
}
