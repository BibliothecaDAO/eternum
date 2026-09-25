import { useUIStore } from "@/hooks/store/use-ui-store";
import { X } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { useSelectedTileDetails } from "@/ui/features/world/components/bottom-right-panel";

/**
 * What the player tapped, with its actions: a sheet over the foot of a phone held upright, a panel down the right
 * edge otherwise. Nothing selected, or a selection with nothing to show, no sheet.
 */
export const FrontierSelectionSheet = () => {
  const details = useSelectedTileDetails();
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  if (!details) return null;

  const close = () => {
    setSelectedHex(null);
    setSelectedBuildingHex(null);
  };

  return (
    <section
      aria-label="Selection"
      className={cn(
        OVERLAY_SURFACE_BASE,
        "pointer-events-auto relative flex max-h-[45dvh] min-h-0 flex-col overflow-hidden rounded-xl",
        "[&:not(:has(>div>*))]:hidden",
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">{details}</div>
    </section>
  );
};
