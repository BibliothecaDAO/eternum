import { useUIStore } from "@/hooks/store/use-ui-store";
import { BiomeSummaryCard, UnoccupiedTileQuadrants } from "@/ui/features/world/components/actions/unoccupied-tile-quadrants";
import { ArmyBannerEntityDetail } from "@/ui/features/world/components/entities/banner/army-banner-entity-detail";
import { StructureBannerEntityDetail } from "@/ui/features/world/components/entities/banner/structure-banner-entity-detail";
import { QuestEntityDetail } from "@/ui/features/world/components/entities/quest-entity-detail";
import { EntityDetailSection } from "@/ui/features/world/components/entities/layout";
import { ID } from "@bibliothecadao/types";
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

  const renderUnexploredMessage = () => (
    <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 text-center">
      <p className="text-xs font-medium text-gold/60 italic text-center">
        Unexplored Territory.
        <br />
        Send an explorer to discover what lies here.
      </p>
    </div>
  );

  if (!tile) {
    return renderUnexploredMessage();
  }

  if (!isExplored) {
    return renderUnexploredMessage();
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
        <div className="grid h-full min-h-0 gap-2 overflow-auto sm:grid-cols-[minmax(0,200px)_1fr]">
          <EntityDetailSection compact tone="highlight" className="h-full">
            <BiomeSummaryCard biome={biome} />
          </EntityDetailSection>
          <EntityDetailSection compact tone="highlight" className="h-full">
            <RelicCrateSummaryPanel crateEntityId={occupierEntityId} />
          </EntityDetailSection>
        </div>
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

const RelicCrateSummaryPanel = ({ crateEntityId }: { crateEntityId: ID }) => {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-col gap-1 text-left">
        <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Relic Crate</span>
        <span className="text-sm font-semibold text-gold">Crate #{crateEntityId}</span>
        <p className="text-xxs text-gold/70">Move an army adjacent to the crate to claim its relics before rivals arrive.</p>
        <p className="text-xxs text-gold/70">The crate contains a cache of 3 relics that can empower armies or structures.</p>
        <p className="text-xxs text-gold/70">Cracking open a relic crate also grants 1000 Victory Points.</p>
      </div>
    </div>
  );
};
