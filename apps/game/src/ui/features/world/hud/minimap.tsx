import { fittedMapAspect, HexMinimap } from "@/ui/features/world/components/bottom-right-panel/hex-minimap";
import { useMinimapReading } from "@/ui/features/world/components/bottom-right-panel";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useMemo } from "react";

/** The panel never turns into a sliver: at most twice as wide as tall, or as tall as wide. */
const ASPECT_LIMITS = { tallest: 0.5, widest: 2 };

/**
 * The HUD's minimap: the map alone in a plate, no title, each occupant's badge filling its hex. Drag it to move the
 * camera. The plate takes the fitted map's shape, so it holds the map and not empty bands around it; short of room,
 * it gives way and the map fits the smaller plate.
 */
export const HudMinimap = ({ className }: { className?: string }) => {
  const { tiles, isLoading, cameraTargetHex, selectedHex, navigationTarget } = useMinimapReading();
  const aspect = useMemo(() => fittedMapAspect(tiles) ?? 1, [tiles]);
  const shape = Math.min(Math.max(aspect, ASPECT_LIMITS.tallest), ASPECT_LIMITS.widest);
  return (
    <section
      aria-label="Minimap"
      className={cn("hud-plate relative overflow-hidden p-1.5", className)}
      style={{ aspectRatio: shape }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[10px] bg-[#0d0a07]">
        <HexMinimap
          look="badges"
          tiles={tiles}
          selectedHex={selectedHex}
          navigationTarget={navigationTarget}
          cameraTargetHex={cameraTargetHex}
        />
        {isLoading && <div className="absolute inset-0 animate-pulse bg-black/30" />}
      </div>
    </section>
  );
};
