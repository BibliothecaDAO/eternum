import { useUIStore } from "@/hooks/store/use-ui-store";
import { X } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { useSelectedTileDetails } from "@/ui/features/world/components/bottom-right-panel";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildSheet, useOpenPlot } from "./build/build-sheet";
import { TileCard, useSelectedSite } from "./sites/tile-card";
import { BuildingUpgrade, useSelectedBuilding } from "./upgrade/building-upgrade";
import { CastleUpgrade, useKeepSelected } from "./upgrade/castle-upgrade";

/**
 * What the player tapped, with its actions: a sheet over the foot of a phone held upright, a panel down the right
 * edge otherwise. An open plot of the realm is the build sheet's, the keep or a building the upgrade sheet's, a
 * standing site the tile card's. Nothing selected, or a selection with nothing to show, no sheet.
 */
export const FrontierSelectionSheet = ({ realm }: { realm: NativeRows["Structure"] | null }) => {
  const details = useSelectedTileDetails();
  const openPlot = useOpenPlot(realm);
  const site = useSelectedSite();
  const keep = useKeepSelected(realm);
  const building = useSelectedBuilding(realm);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const close = () => {
    setSelectedHex(null);
    setSelectedBuildingHex(null);
  };
  if (realm && openPlot) return <BuildSheet realm={realm} plot={openPlot} onClose={close} />;
  if (site) return <TileCard selected={site} onClose={close} />;
  if (realm && keep) return <CastleUpgrade realm={realm} onClose={close} />;
  if (realm && building) return <BuildingUpgrade realm={realm} selected={building} onClose={close} />;
  if (!details) return null;

  return (
    <section
      aria-label="Selection"
      data-selection-sheet
      className={cn(
        OVERLAY_SURFACE_BASE,
        "pointer-events-auto relative flex max-h-[45dvh] min-h-0 flex-col overflow-hidden rounded-xl",
        // A selection whose details render nothing shows no sheet; the HUD reads the same test to hold Ysolde back.
        "[&:not(:has([data-sheet-content]>*))]:hidden",
        "landscape:order-last landscape:max-h-full landscape:w-[min(380px,42vw)]",
      )}
    >
      <button
        type="button"
        aria-label="Close selection"
        onClick={close}
        className="absolute right-1.5 top-1.5 z-10 flex h-11 w-11 items-center justify-center rounded-md text-gold/70 hover:text-gold lg:h-8 lg:w-8"
      >
        <X className="h-4 w-4" />
      </button>
      <div data-sheet-content className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {details}
      </div>
    </section>
  );
};
