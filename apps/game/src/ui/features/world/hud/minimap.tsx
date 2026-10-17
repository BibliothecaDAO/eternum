import { HexMinimap } from "@/ui/features/world/components/bottom-right-panel/hex-minimap";
import { useMinimapReading } from "@/ui/features/world/components/bottom-right-panel";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { cn } from "@/ui/design-system/atoms/lib/utils";

/**
 * The HUD's minimap: a HUD panel with no title, the map alone in a square, each occupant's badge filling its hex,
 * following the camera and its zoom. Drag it to move the camera. Short of room, the panel gives way and the map fills
 * the smaller one.
 */
export const HudMinimap = ({ className }: { className?: string }) => {
  const { tiles, isLoading, cameraTargetHex, selectedHex, navigationTarget } = useMinimapReading();
  return (
    <InfoBubble label="Minimap" className={cn("aspect-square overflow-hidden", className)} bodyClassName="h-full p-1.5">
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
    </InfoBubble>
  );
};
