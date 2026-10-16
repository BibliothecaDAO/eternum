import { HexMinimap } from "@/ui/features/world/components/bottom-right-panel/hex-minimap";
import { useMinimapReading } from "@/ui/features/world/components/bottom-right-panel";
import { cn } from "@/ui/design-system/atoms/lib/utils";

/**
 * The HUD's minimap: the map alone in a plate, no title, each occupant's badge filling its hex. Drag it to move the
 * camera.
 */
export const HudMinimap = ({ className }: { className?: string }) => {
  const { tiles, isLoading, cameraTargetHex, selectedHex, navigationTarget } = useMinimapReading();
  return (
    <section aria-label="Minimap" className={cn("hud-plate relative overflow-hidden p-1.5", className)}>
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
