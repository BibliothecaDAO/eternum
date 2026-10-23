import type { MapSelectionIntent } from "@/hooks/store/map-selection";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { traceFlightMark } from "@/three/flight-trace";
import { getActiveGameStore } from "@/sync/active-game-client";
import {
  configManager,
  getBlockTimestamp,
  readExpeditionRules,
  seasonDay,
  type Position,
} from "@bibliothecadao/eternum";

import { buildPlayHref, mapRouteHex, parsePlayRoute, type PlayScene } from "./play-route";

/**
 * The one way the match's links move the view: the match's route on `scene` at a map position, pushed in the page for
 * the renderer to follow (urlChanged), never loaded again. The position states the space it was read in and the URL
 * carries it normalized (mapRouteHex), so every link names a place the same way. A building being placed is dropped.
 */
export function openPlace(scene: PlayScene, position: Position): void {
  const route = parsePlayRoute(window.location);
  if (!route) throw new Error(`Cannot open a place outside a game route: ${window.location.pathname}`);
  const ui = useUIStore.getState();
  ui.setShowBlankOverlay(false);
  ui.setPreviewBuilding(null);
  const href = buildPlayHref({ ...route, scene, ...mapRouteHex(position) });
  traceFlightMark(`navigate ${href}`);
  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event("urlChanged"));
  traceFlightMark("urlChanged listeners done");
}

/**
 * Opens the world map on a position with what the link names selected there: the tile itself ("tile"), the structure
 * or army standing on it, or nothing (the camera alone). The map clears its selection as it moves, so the link's
 * selection is made once it has.
 */
export function openOnMap(position: Position, select: "tile" | MapSelectionIntent): void {
  openPlace("map", position);
  const { x, y } = position.getContract();
  useUIStore.getState().selectOnMap(select === "tile" ? { kind: "hex", hex: { col: x, row: y } } : select);
}

/**
 * A link to where something happened at `seconds` (chain time), opened by `open`, or none: Frontier builds its map
 * again each day, so a place from a day that has closed names nothing on today's map, and following it sends the
 * player somewhere wrong. Today is the map's own, read on the block clock its sites are placed by. Another mode keeps
 * one map all game, and its links stand. Checked again on the press, in case the day closed under an open row.
 */
export function linkFrom(seconds: number, open: () => void): (() => void) | null {
  const onTodaysMap = () => {
    const store = getActiveGameStore();
    const rules = store && readExpeditionRules(store, configManager.getActiveGameId());
    return !rules || seasonDay(rules, seconds) === seasonDay(rules, getBlockTimestamp().currentBlockTimestamp);
  };
  if (!onTodaysMap()) return null;
  return () => {
    if (onTodaysMap()) open();
  };
}
