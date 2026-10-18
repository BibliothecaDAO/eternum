import { HexMinimap } from "@/ui/features/world/components/bottom-right-panel/hex-minimap";
import { useMinimapReading } from "@/ui/features/world/components/bottom-right-panel";
import { HudMinimapFrame } from "@/ui/design-system/kit/hud-elements";
import { cn } from "@/ui/design-system/atoms/lib/utils";

/**
 * The HUD's minimap: a HUD panel with no title, the map alone in a square, each occupant's badge filling its hex,
 * following the camera and its zoom. Drag it to move the camera. Short of room, the panel gives way and the map fills
 * the smaller one.
 */
export const HudMinimap = ({ className }: { className?: string }) => {
  const { tiles, isLoading, cameraTargetHex, selectedHex, navigationTarget } = useMinimapReading();
  return (
    <HudMinimapFrame loading={isLoading} className={cn("aspect-square overflow-hidden", className)}>
      <HexMinimap
        look="badges"
        tiles={tiles}
        selectedHex={selectedHex}
        navigationTarget={navigationTarget}
        cameraTargetHex={cameraTargetHex}
      />
    </HudMinimapFrame>
  );
};
