import type { HexPosition } from "@bibliothecadao/types";

import {
  WORLDMAP_STRATEGIC_ENTRY_SCALE,
  WORLDMAP_STRATEGIC_MAX_SCALE,
  WORLDMAP_STRATEGIC_MIN_SCALE,
} from "@/three/scenes/worldmap-navigation/world-navigation-mode-machine";

import { contractHexToCenteredHex, offsetToPixel } from "./strategic-map-coordinates";

export interface StrategicMapView {
  x: number;
  y: number;
  scale: number;
}

export interface StrategicMapViewport {
  width: number;
  height: number;
}

const MINIMAP_SCALE_REFERENCE = 1.4;
const WORLD_CAMERA_DISTANCE_REFERENCE = 20;

export function resolveMinimapScaleFromCameraDistance(cameraDistance: number | null): number {
  if (!cameraDistance) {
    return MINIMAP_SCALE_REFERENCE;
  }

  return clamp((MINIMAP_SCALE_REFERENCE * WORLD_CAMERA_DISTANCE_REFERENCE) / cameraDistance, 0.4, 4);
}

export function applyStrategicMapScaleDelta(input: { currentScale: number; normalizedDelta: number }): number {
  const nextScale = input.currentScale * Math.exp(-input.normalizedDelta / 1200);
  return clampStrategicMapScale(nextScale);
}

function clampStrategicMapScale(scale: number): number {
  return clamp(scale, WORLDMAP_STRATEGIC_MIN_SCALE, WORLDMAP_STRATEGIC_MAX_SCALE);
}

export function resolveStrategicMapEntryScale(): number {
  return WORLDMAP_STRATEGIC_ENTRY_SCALE;
}

export function resolveStrategicMapInitialView(input: {
  centerHex?: HexPosition | null;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  scale: number;
  hasTiles: boolean;
}): StrategicMapView {
  if (!input.hasTiles) {
    return {
      x: 0,
      y: 0,
      scale: input.scale,
    };
  }

  if (input.centerHex) {
    const centered = contractHexToCenteredHex(input.centerHex);
    const pixel = offsetToPixel(centered.col, centered.row);
    return {
      x: pixel.x,
      y: pixel.y,
      scale: input.scale,
    };
  }

  return {
    x: (input.bounds.minX + input.bounds.maxX) / 2,
    y: (input.bounds.minY + input.bounds.maxY) / 2,
    scale: input.scale,
  };
}

export function resolveStrategicMapViewBox(input: { view: StrategicMapView; viewport: StrategicMapViewport }): {
  minX: number;
  minY: number;
  width: number;
  height: number;
  value: string;
} {
  const width = input.viewport.width / input.view.scale;
  const height = input.viewport.height / input.view.scale;
  const minX = input.view.x - width / 2;
  const minY = input.view.y - height / 2;

  return {
    minX,
    minY,
    width,
    height,
    value: `${minX} ${minY} ${width} ${height}`,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
