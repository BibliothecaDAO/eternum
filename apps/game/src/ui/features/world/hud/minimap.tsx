import { HexMinimap } from "@/ui/features/world/components/bottom-right-panel/hex-minimap";
import { useMinimapReading } from "@/ui/features/world/components/bottom-right-panel";
import { HudMinimapFrame } from "@/ui/design-system/kit/hud-elements";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useQuery } from "@/hooks/helpers/use-query";

/**
 * The HUD's minimap: a HUD panel with no title, the map alone in a square, each occupant's badge filling its hex,
 * following the camera and its zoom. Drag it to move the camera. Short of room, the panel gives way and the map fills
 * the smaller one. It is the world map's: the realm view, whose camera is not on the world, has none.
 */
export const HudMinimap = ({ className }: { className?: string }) =>
  useQuery().isMapView ? <WorldMinimap className={className} /> : null;

const WorldMinimap = ({ className }: { className?: string }) => {
  const { tiles, isLoading, cameraTargetHex, selectedHex } = useMinimapReading();
  return (
    <HudMinimapFrame loading={isLoading} className={cn("aspect-square overflow-hidden", className)}>
      <HexMinimap look="badges" tiles={tiles} selectedHex={selectedHex} cameraTargetHex={cameraTargetHex} />
    </HudMinimapFrame>
  );
};
