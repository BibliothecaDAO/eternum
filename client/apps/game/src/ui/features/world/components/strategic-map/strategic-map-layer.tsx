import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  requestWorldNavigationExit2DToHex,
  requestWorldNavigationPanToHex,
  requestWorldNavigationSelectHex,
  requestWorldNavigationZoomDelta,
} from "@/three/scenes/worldmap-navigation/world-navigation-bridge";
import { resolveWorldmapStrategicVisualPolicy } from "@/three/scenes/worldmap-navigation/worldmap-strategic-visual-policy";
import { useQuery } from "@bibliothecadao/react";
import { useEffect } from "react";

import { StrategicMapRenderer } from "./strategic-map-renderer";
import { resolveStrategicLayerBackdrop, type StrategicMapRenderMode } from "./strategic-map-style-profile";
import { resolveStrategicMapFallbackScale } from "./strategic-map-viewport";
import { useStrategicMapTiles } from "./use-strategic-map-tiles";

export const StrategicMapLayer = () => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const navigationTarget = useUIStore((state) => state.navigationTarget);
  const cameraTargetHex = useUIStore((state) => state.cameraTargetHex);
  const strategicMapCenterHex = useUIStore((state) => state.strategicMapCenterHex);
  const strategicMapScale = useUIStore((state) => state.strategicMapScale);
  const worldNavigationMode = useUIStore((state) => state.worldNavigationMode);
  const worldNavigationZoomLevel = useUIStore((state) => state.worldNavigationZoomLevel);
  const worldNavigationTransitionProgress = useUIStore((state) => state.worldNavigationTransitionProgress);
  const visualPolicy = resolveWorldmapStrategicVisualPolicy({
    mode: worldNavigationMode,
    transitionProgress: worldNavigationTransitionProgress,
    zoomLevel: worldNavigationZoomLevel,
  });
  const renderMode: StrategicMapRenderMode = worldNavigationMode === "strategic_2d" ? "strategic" : "transition";
  const layerBackdrop = resolveStrategicLayerBackdrop(renderMode);
  const resolvedStrategicMapScale = strategicMapScale ?? resolveStrategicMapFallbackScale();
  const shouldLoadTiles = isMapView && (visualPolicy.overlayOpacity > 0 || worldNavigationMode === "strategic_2d");
  const { tiles, isLoading, error } = useStrategicMapTiles(shouldLoadTiles);

  useEffect(() => {
    if (worldNavigationMode !== "strategic_2d") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") {
        return;
      }

      const targetHex = selectedHex ?? strategicMapCenterHex ?? cameraTargetHex;
      if (!targetHex) {
        return;
      }

      event.preventDefault();
      requestWorldNavigationExit2DToHex(targetHex);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cameraTargetHex, selectedHex, strategicMapCenterHex, worldNavigationMode]);

  if (!isMapView || visualPolicy.overlayOpacity <= 0.001) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[15] transition-opacity duration-150"
      style={{ opacity: visualPolicy.overlayOpacity }}
    >
      <div className="absolute inset-0" style={{ background: layerBackdrop.background }} />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: layerBackdrop.texture }} />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: layerBackdrop.vignette,
          opacity: Math.max(visualPolicy.unexploredMaskOpacity, 0.28),
        }}
      />
      <div
        className="pointer-events-none absolute inset-[14px] rounded-[32px] border"
        style={{ borderColor: layerBackdrop.frameBorder }}
      />
      <div
        className="absolute inset-0"
        style={{
          pointerEvents: visualPolicy.strategicLayerPointerEvents ? "auto" : "none",
        }}
      >
        <StrategicMapRenderer
          renderMode={renderMode}
          tiles={tiles}
          selectedHex={selectedHex}
          navigationTarget={navigationTarget}
          cameraTargetHex={cameraTargetHex}
          centerHex={strategicMapCenterHex ?? cameraTargetHex ?? navigationTarget ?? selectedHex}
          scale={resolvedStrategicMapScale}
          interactive={visualPolicy.strategicLayerPointerEvents}
          className="absolute inset-0 h-full w-full touch-none select-none"
          visualPolicy={{
            strategicSurfaceOpacity: visualPolicy.strategicSurfaceOpacity,
            strategicMarkerOpacity: visualPolicy.strategicMarkerOpacity,
            strategicMarkerScale: visualPolicy.strategicMarkerScale,
            selectionRingOpacity: visualPolicy.selectionRingOpacity,
            unexploredMaskOpacity: visualPolicy.unexploredMaskOpacity,
          }}
          onActivateHex={(hex) => {
            requestWorldNavigationSelectHex(hex);
            requestWorldNavigationExit2DToHex(hex);
          }}
          onPanToHex={(hex) => requestWorldNavigationPanToHex(hex)}
          onSelectHex={(hex) => requestWorldNavigationSelectHex(hex)}
          onZoomDelta={(delta) => requestWorldNavigationZoomDelta(delta, "strategic_map")}
        />
      </div>
      {worldNavigationMode === "strategic_2d" ? (
        <div className="pointer-events-none absolute top-4 left-1/2 z-[1] -translate-x-1/2 rounded-full border border-gold/30 bg-black/60 px-4 py-2.5 shadow-xl backdrop-blur-sm">
          <div className="text-center text-[11px] uppercase tracking-[0.32em] text-gold/80">Strategic Map</div>
          <div className="mt-1 text-center text-[10px] tracking-[0.14em] text-gold/50">
            Scroll in or double-click to return
          </div>
        </div>
      ) : null}
      {isLoading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
        </div>
      ) : null}
      {error ? (
        <div className="pointer-events-none absolute right-4 bottom-4 rounded bg-black/70 px-3 py-1 text-xxs text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
};
