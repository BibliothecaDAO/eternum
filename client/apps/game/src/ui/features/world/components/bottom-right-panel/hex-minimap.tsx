import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  requestWorldNavigationPanToHex,
  requestWorldNavigationSelectHex,
  requestWorldNavigationZoomDelta,
} from "@/three/scenes/worldmap-navigation/world-navigation-bridge";
import type { HexPosition } from "@bibliothecadao/types";

import { type MinimapTile } from "../strategic-map/strategic-map-coordinates";
import { StrategicMapRenderer } from "../strategic-map/strategic-map-renderer";
import { resolveMinimapScaleFromCameraDistance } from "../strategic-map/strategic-map-viewport";

interface HexMinimapProps {
  tiles: MinimapTile[];
  selectedHex: HexPosition | null;
  navigationTarget: HexPosition | null;
  cameraTargetHex: HexPosition | null;
}

export const HexMinimap = ({ tiles, selectedHex, navigationTarget, cameraTargetHex }: HexMinimapProps) => {
  const cameraDistance = useUIStore((state) => state.cameraDistance);
  const scale = resolveMinimapScaleFromCameraDistance(cameraDistance);

  return (
    <StrategicMapRenderer
      renderMode="minimap"
      tiles={tiles}
      selectedHex={selectedHex}
      navigationTarget={navigationTarget}
      cameraTargetHex={cameraTargetHex}
      scale={scale}
      showCameraCircle
      resetOnDoubleClick
      className="absolute inset-0 h-full w-full touch-none select-none"
      onPanToHex={(hex) => requestWorldNavigationPanToHex(hex)}
      onSelectHex={(hex) => requestWorldNavigationSelectHex(hex)}
      onZoomDelta={(delta) => requestWorldNavigationZoomDelta(delta, "minimap")}
    />
  );
};
