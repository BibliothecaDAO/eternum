import type { WorldNavigationMode } from "./world-navigation-mode-machine";

export interface WorldmapStrategicVisualPolicy {
  overlayOpacity: number;
  strategicLayerPointerEvents: boolean;
  suppressWorldInteractions: boolean;
  suppressWorldHover: boolean;
  disableDirectionalShadows: boolean;
  worldGridOpacity: number;
  worldTerrainContrast: number;
  worldTerrainSaturation: number;
  worldEntityOpacity: number;
  strategicSurfaceOpacity: number;
  strategicMarkerOpacity: number;
  strategicMarkerScale: number;
  unexploredMaskOpacity: number;
  selectionRingOpacity: number;
}

export function resolveWorldmapStrategicVisualPolicy(input: {
  mode: WorldNavigationMode;
  transitionProgress: number;
  zoomLevel?: number;
}): WorldmapStrategicVisualPolicy {
  const zoomLevel = clamp(input.zoomLevel ?? 0, 0, 1);
  const transitionProgress = clamp(input.transitionProgress, 0, 1);
  const farBandProgress = clamp((zoomLevel - 0.45) / 0.22, 0, 1);
  const easedTransition = easeOutCubic(transitionProgress);

  const farTerrainContrast = mix(1, 0.85, farBandProgress);
  const farTerrainSaturation = mix(1, 0.9, farBandProgress);
  const farEntityOpacity = mix(1, 0.94, farBandProgress);
  const farGridOpacity = mix(0.1, 0.08, farBandProgress);

  if (input.mode === "three_d") {
    return {
      overlayOpacity: 0,
      strategicLayerPointerEvents: false,
      suppressWorldInteractions: false,
      suppressWorldHover: false,
      disableDirectionalShadows: false,
      worldGridOpacity: farGridOpacity,
      worldTerrainContrast: farTerrainContrast,
      worldTerrainSaturation: farTerrainSaturation,
      worldEntityOpacity: farEntityOpacity,
      strategicSurfaceOpacity: 0,
      strategicMarkerOpacity: 0,
      strategicMarkerScale: 0.9,
      unexploredMaskOpacity: 0,
      selectionRingOpacity: 0.38,
    };
  }

  if (input.mode === "strategic_2d") {
    return {
      overlayOpacity: 1,
      strategicLayerPointerEvents: true,
      suppressWorldInteractions: true,
      suppressWorldHover: true,
      disableDirectionalShadows: true,
      worldGridOpacity: 0.012,
      worldTerrainContrast: 0.64,
      worldTerrainSaturation: 0.62,
      worldEntityOpacity: 0.34,
      strategicSurfaceOpacity: 0.96,
      strategicMarkerOpacity: 1,
      strategicMarkerScale: 1.08,
      unexploredMaskOpacity: 0.62,
      selectionRingOpacity: 1,
    };
  }

  const strategicSurfaceOpacity = mix(0.25, 0.92, Math.pow(transitionProgress, 0.75));
  const markerProgress = clamp((transitionProgress - 0.1) / 0.9, 0, 1);

  return {
    overlayOpacity: mix(0.18, 0.98, Math.pow(transitionProgress, 0.72)),
    strategicLayerPointerEvents: false,
    suppressWorldInteractions: true,
    suppressWorldHover: true,
    disableDirectionalShadows: transitionProgress >= 0.28,
    worldGridOpacity: mix(farGridOpacity, 0.018, easedTransition),
    worldTerrainContrast: mix(farTerrainContrast, 0.65, easedTransition),
    worldTerrainSaturation: mix(farTerrainSaturation, 0.7, easedTransition),
    worldEntityOpacity: mix(farEntityOpacity, 0.42, easedTransition),
    strategicSurfaceOpacity,
    strategicMarkerOpacity: mix(0.08, 0.94, Math.pow(markerProgress, 0.85)),
    strategicMarkerScale: mix(0.92, 1.03, easedTransition),
    unexploredMaskOpacity: mix(0.2, 0.55, Math.pow(transitionProgress, 0.9)),
    selectionRingOpacity: mix(0.45, 0.92, easedTransition),
  };
}

function easeOutCubic(value: number): number {
  const clamped = clamp(value, 0, 1);
  return 1 - Math.pow(1 - clamped, 3);
}

function mix(start: number, end: number, amount: number): number {
  return start + (end - start) * clamp(amount, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
