import type { HexPosition } from "@bibliothecadao/types";

export type WorldNavigationZoomSource = "minimap" | "strategic_map";

export const WORLD_NAVIGATION_PAN_TO_HEX_EVENT = "eternum:world-navigation:pan-to-hex";
export const WORLD_NAVIGATION_ZOOM_DELTA_EVENT = "eternum:world-navigation:zoom-delta";
export const WORLD_NAVIGATION_SELECT_HEX_EVENT = "eternum:world-navigation:select-hex";
export const WORLD_NAVIGATION_EXIT_2D_TO_HEX_EVENT = "eternum:world-navigation:exit-2d-to-hex";

export interface WorldNavigationPanToHexDetail {
  hex: HexPosition;
}

export interface WorldNavigationZoomDeltaDetail {
  delta: number;
  source: WorldNavigationZoomSource;
}

export interface WorldNavigationSelectHexDetail {
  hex: HexPosition;
}

export interface WorldNavigationExit2DToHexDetail {
  hex: HexPosition;
}

export function requestWorldNavigationPanToHex(hex: HexPosition): void {
  dispatchWorldNavigationEvent<WorldNavigationPanToHexDetail>(WORLD_NAVIGATION_PAN_TO_HEX_EVENT, { hex });
}

export function requestWorldNavigationZoomDelta(delta: number, source: WorldNavigationZoomSource): void {
  dispatchWorldNavigationEvent<WorldNavigationZoomDeltaDetail>(WORLD_NAVIGATION_ZOOM_DELTA_EVENT, {
    delta,
    source,
  });
}

export function requestWorldNavigationSelectHex(hex: HexPosition): void {
  dispatchWorldNavigationEvent<WorldNavigationSelectHexDetail>(WORLD_NAVIGATION_SELECT_HEX_EVENT, { hex });
}

export function requestWorldNavigationExit2DToHex(hex: HexPosition): void {
  dispatchWorldNavigationEvent<WorldNavigationExit2DToHexDetail>(WORLD_NAVIGATION_EXIT_2D_TO_HEX_EVENT, { hex });
}

function dispatchWorldNavigationEvent<T>(eventName: string, detail: T): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<T>(eventName, { detail }));
}
