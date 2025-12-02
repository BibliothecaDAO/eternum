import { useUIStore } from "@/hooks/store/use-ui-store";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { StructureBannerEntityDetail } from "@/ui/features/world/components/entities/banner/structure-banner-entity-detail";
import { BottomHudEmptyState } from "@/ui/features/world/components/hud-bottom";
import { useQuery } from "@bibliothecadao/react";
import { memo, ReactNode } from "react";

import { BOTTOM_PANEL_HEIGHT, BOTTOM_PANEL_MARGIN } from "./constants";

interface PanelFrameProps {
  title: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}

const PanelFrame = ({ title, badge, children, className }: PanelFrameProps) => (
  <section
    className={cn(
      "pointer-events-auto panel-wood panel-wood-corners border border-gold/20 bg-black/60 shadow-2xl flex h-full flex-col overflow-hidden",
      className,
    )}
    style={{ height: `${BOTTOM_PANEL_HEIGHT}px` }}
  >
    <header className="flex items-center justify-between border-b border-gold/20 px-4 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold/70">{title}</p>
      {badge && (
        <span className="rounded-full border border-gold/40 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/80">
          {badge}
        </span>
      )}
    </header>
    <div className="flex-1 min-h-0 overflow-hidden px-3 py-2">{children}</div>
  </section>
);

const RealmPanel = () => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const isSpectating = useUIStore((state) => state.isSpectating);
  const hasSelection = structureEntityId !== UNDEFINED_STRUCTURE_ENTITY_ID;

  return (
    <PanelFrame title="Selected Realm" badge={isSpectating ? "Spectating" : undefined}>
      {hasSelection ? (
        <div className="h-full min-h-0 overflow-hidden">
          <StructureBannerEntityDetail
            structureEntityId={structureEntityId}
            className="h-full min-h-0"
            compact
            layoutVariant="banner"
            showButtons={false}
            maxInventory={8}
          />
        </div>
      ) : (
        <BottomHudEmptyState
          align="center"
          tone="subtle"
          className="min-h-[140px] justify-center"
          textClassName="text-xs text-gold/70"
        >
          Select a realm or structure to inspect its status.
        </BottomHudEmptyState>
      )}
    </PanelFrame>
  );
};

const TilePanel = () => {
  const selectedHex = useUIStore((state) => state.selectedHex);

  return (
    <PanelFrame title="Selected Tile">
      {selectedHex ? (
        <div className="h-full min-h-0 overflow-hidden">
          <SelectedWorldmapEntity />
        </div>
      ) : (
        <BottomHudEmptyState
          align="center"
          tone="subtle"
          className="min-h-[140px] justify-center"
          textClassName="text-xs text-gold/70"
        >
          Tap any tile on the world map to view its occupants and resources.
        </BottomHudEmptyState>
      )}
    </PanelFrame>
  );
};

export const BottomPanels = memo(() => {
  const { isMapView } = useQuery();
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const shouldShow = isMapView && !showBlankOverlay;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[35] flex flex-col gap-4 px-0 transition-all duration-300 md:flex-row md:items-end md:justify-between",
        shouldShow ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-6",
      )}
      aria-hidden={!shouldShow}
      style={{ bottom: `${BOTTOM_PANEL_MARGIN}px` }}
    >
      <div className="w-full md:w-auto md:max-w-[520px] lg:max-w-[560px]">
        <RealmPanel />
      </div>
      <div className="w-full md:w-auto md:max-w-[520px] lg:max-w-[560px] md:ml-auto">
        <TilePanel />
      </div>
    </div>
  );
});

BottomPanels.displayName = "BottomPanels";
