import { useUIStore } from "@/hooks/store/use-ui-store";
import { UnoccupiedTileQuadrants } from "@/ui/features/world/components/actions/unoccupied-tile-quadrants";
import { BottomHudEmptyState } from "@/ui/features/world/components/hud-bottom";
import { ArmyBannerEntityDetail } from "@/ui/features/world/components/entities/banner/army-banner-entity-detail";
import { StructureBannerEntityDetail } from "@/ui/features/world/components/entities/banner/structure-banner-entity-detail";
import { QuestEntityDetail } from "@/ui/features/world/components/entities/quest-entity-detail";
import { RelicCrateEntityDetail } from "@/ui/features/world/components/entities/relic-crate-entity-detail";
import {
  Biome,
  getEntityIdFromKeys,
  isTileOccupierChest,
  isTileOccupierQuest,
  isTileOccupierStructure,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { HexPosition } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

export const SelectedWorldmapEntity = () => {
  const selectedHex = useUIStore((state) => state.selectedHex);

  if (!selectedHex) {
    return null;
  }

  return <SelectedWorldmapEntityContent selectedHex={selectedHex} />;
};

const SelectedWorldmapEntityContent = ({ selectedHex }: { selectedHex: HexPosition }) => {
  const { setup } = useDojo();
  const tileComponent = setup.components.Tile;

  const gridTemplateColumns = "var(--selected-worldmap-entity-grid-cols, 1fr)";
  const gridTemplateRows = "var(--selected-worldmap-entity-grid-rows, auto)";

  const tile = useMemo(() => {
    if (!selectedHex || !tileComponent) return undefined;
    const contractPosition = {
      x: BigInt(selectedHex.col),
      y: BigInt(selectedHex.row),
    };

    return getComponentValue(tileComponent, getEntityIdFromKeys([contractPosition.x, contractPosition.y]));
  }, [tileComponent, selectedHex?.col, selectedHex?.row]);

  const biome = useMemo(() => {
    return Biome.getBiome(selectedHex.col || 0, selectedHex.row || 0);
  }, [selectedHex.col, selectedHex.row]);

  const hasOccupier = !!tile && Number(tile.occupier_id) !== 0;
  const occupierType = tile?.occupier_type ?? 0;
  const isStructure = isTileOccupierStructure(occupierType);
  const isChest = isTileOccupierChest(occupierType);
  const isQuest = isTileOccupierQuest(occupierType);
  const isExplored = !!tile && Number(tile.biome) !== 0;

  if (!tile) {
    return null;
  }

  if (!isExplored) {
    return (
      <BottomHudEmptyState>Unexplored territory. Send an explorer to reveal this tile.</BottomHudEmptyState>
    );
  }

  if (!hasOccupier) {
    return <UnoccupiedTileQuadrants biome={biome} />;
  }

  const gridAutoRows = "var(--selected-worldmap-entity-grid-auto-rows, minmax(0, auto))";

  const occupierEntityId = tile.occupier_id;
  const sharedDetailProps = {
    compact: true,
    layoutVariant: "banner",
  } as const;

  return (
    <div
      className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto"
      style={{ gridTemplateColumns, gridTemplateRows, gridAutoRows }}
    >
      {isStructure ? (
        <StructureBannerEntityDetail
          structureEntityId={occupierEntityId}
          maxInventory={12}
          showButtons={false}
          {...sharedDetailProps}
        />
      ) : isChest ? (
        <RelicCrateEntityDetail crateEntityId={occupierEntityId} {...sharedDetailProps} />
      ) : isQuest ? (
        <QuestEntityDetail questEntityId={occupierEntityId} className="h-full" {...sharedDetailProps} />
      ) : (
        <ArmyBannerEntityDetail
          armyEntityId={occupierEntityId}
          showButtons={false}
          bannerPosition={selectedHex}
          {...sharedDetailProps}
        />
      )}
    </div>
  );
};
