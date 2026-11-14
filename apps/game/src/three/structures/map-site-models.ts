import { getGameModeConfig } from "@/config/game-modes";
import type { MapSiteKind } from "@/config/map-sites";

import { frontierPaintedPath } from "./frontier-painted-buildings";

/** Each site of the map's catalog (MAP_SITES), as a map draws it outside Frontier. */
const SITE_MODELS: Record<MapSiteKind, string> = {
  Shrine: "/models/outposts/shrine.glb",
  Well: "/models/outposts/well.glb",
};

/** The model a map draws a site as: Frontier's own are painted, the other modes' are the catalog's. */
export function mapSiteModelPath(kind: MapSiteKind): string {
  return getGameModeConfig().id === "frontier" ? frontierPaintedPath(kind.toLowerCase()) : SITE_MODELS[kind];
}
