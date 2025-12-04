import { useUIStore } from "@/hooks/store/use-ui-store";
import { FELT_CENTER } from "@/ui/config";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import {
  getEntityIdFromKeys,
  isTileOccupierChest,
  isTileOccupierQuest,
  isTileOccupierStructure,
  Position as PositionInterface,
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { memo, ReactNode, useMemo } from "react";

import { BOTTOM_PANEL_HEIGHT, BOTTOM_PANEL_MARGIN } from "./constants";

interface PanelFrameProps {
  title: string;
  children: ReactNode;
  className?: string;
}

const PanelFrame = ({ title, children, className }: PanelFrameProps) => (
  <section
    className={cn(
      "pointer-events-auto panel-wood panel-wood-corners border border-gold/20 bg-black/60 shadow-2xl flex h-full flex-col overflow-hidden",
      className,
    )}
    style={{ height: `${BOTTOM_PANEL_HEIGHT}px` }}
  >
    <header className="flex items-center justify-between border-b border-gold/20 px-4 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold/70">{title}</p>
    </header>
    <div className="flex-1 min-h-0 overflow-hidden px-3 py-2">{children}</div>
  </section>
);

const TilePanel = () => {
  const selectedHex = useUIStore((state) => state.selectedHex);
  const { setup } = useDojo();
  const tileComponent = setup.components.Tile;

  const tile = useMemo(() => {
    if (!selectedHex || !tileComponent) return null;
    const selectedHexContract = new PositionInterface({
      x: selectedHex.col,
      y: selectedHex.row,
    }).getContract();
    return getComponentValue(
      tileComponent,
      getEntityIdFromKeys([BigInt(selectedHexContract.x), BigInt(selectedHexContract.y)]),
    );
  }, [selectedHex?.col, selectedHex?.row, tileComponent]);

  const hasOccupier = useMemo(() => {
    if (!tile) return false;
    return tile.occupier_id !== 0;
  }, [tile]);

  const isStructure = useMemo(() => {
    return isTileOccupierStructure(tile?.occupier_type || 0);
  }, [tile]);

  const isChest = useMemo(() => {
    return isTileOccupierChest(tile?.occupier_type || 0);
  }, [tile]);

  const isQuest = useMemo(() => {
    return isTileOccupierQuest(tile?.occupier_type || 0);
  }, [tile]);

  const tileTypeLabel = useMemo(() => {
    if (!tile) return "Hex Tile";
    if (!hasOccupier) return "Biome Tile";
    if (isStructure) return "Structure Tile";
    if (isChest) return "Relic Tile";
    if (isQuest) return "Quest Tile";
    return "Army Tile";
  }, [tile, hasOccupier, isStructure, isChest, isQuest]);

  const panelTitle = selectedHex
    ? `${tileTypeLabel} · (${selectedHex.col - FELT_CENTER()}, ${selectedHex.row - FELT_CENTER()})`
    : "No Tile Selected";

  return (
    <PanelFrame title={panelTitle}>
      {selectedHex ? (
        <div className="h-full min-h-0 overflow-hidden">
          <SelectedWorldmapEntity />
        </div>
      ) : (
        <div className="flex min-h-[140px] flex-col items-center justify-center text-center">
          <p className="text-xs text-gold/70">Tap any tile on the world map to view its occupants and resources.</p>
        </div>
      )}
    </PanelFrame>
  );
};

export const SelectedTilePanel = memo(() => {
  const { isMapView } = useQuery();
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const shouldShow = isMapView && !showBlankOverlay;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[35] flex flex-col gap-4 px-0 transition-all duration-300 md:flex-row md:items-end md:justify-end",
        shouldShow ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-6",
      )}
      aria-hidden={!shouldShow}
      style={{ bottom: `${BOTTOM_PANEL_MARGIN}px` }}
    >
      <div className="w-full md:w-auto md:max-w-[460px] lg:max-w-[480px] md:ml-auto">
        <TilePanel />
      </div>
    </div>
  );
});

SelectedTilePanel.displayName = "SelectedTilePanel";
