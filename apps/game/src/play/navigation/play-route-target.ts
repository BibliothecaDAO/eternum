import { Position } from "@bibliothecadao/eternum";
import { resolveSpectateIntent } from "@/utils/spectator-session";

import { parsePlayRoute, type PlayRouteDescriptor, type PlayScene } from "./play-route";

type LocationLike = Pick<Location, "pathname" | "search">;

interface PlayRouteWorldPosition {
  col: number;
  row: number;
}

interface ResolvedPlayRouteTarget {
  scene: PlayScene;
  requestedScene: PlayScene | null;
  routeWorldPosition: PlayRouteWorldPosition | null;
  hexRealmPosition: PlayRouteWorldPosition | null;
  hexCameraTarget: "keep-center" | null;
  spectate: boolean;
  isCanonical: boolean;
  playRoute: PlayRouteDescriptor | null;
}

const isFiniteCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const resolveRouteWorldPositionFromPlayRoute = (
  playRoute: PlayRouteDescriptor | null,
): PlayRouteWorldPosition | null => {
  if (!playRoute) {
    return null;
  }

  // A map URL carries normalized hexes (mapRouteHex); it is read as written, never guessed from its magnitude.
  if (!isFiniteCoordinate(playRoute.col) || !isFiniteCoordinate(playRoute.row)) return null;
  return { col: playRoute.col, row: playRoute.row };
};

export const resolvePlayRouteWorldPosition = (location: LocationLike): PlayRouteWorldPosition | null => {
  return resolveRouteWorldPositionFromPlayRoute(parsePlayRoute(location));
};

const resolveHexRealmPosition = (
  scene: PlayScene,
  routeWorldPosition: PlayRouteWorldPosition | null,
): PlayRouteWorldPosition | null => {
  if (scene !== "hex" || routeWorldPosition == null) {
    return null;
  }

  const contractPosition = Position.fromNormalized({
    x: routeWorldPosition.col,
    y: routeWorldPosition.row,
  }).getContract();
  return {
    col: contractPosition.x,
    row: contractPosition.y,
  };
};

export const resolvePlayRouteTarget = (location: LocationLike): ResolvedPlayRouteTarget => {
  const playRoute = parsePlayRoute(location);
  const routeWorldPosition = resolveRouteWorldPositionFromPlayRoute(playRoute);
  const requestedScene = playRoute?.scene ?? null;
  const scene = requestedScene ?? "map";

  return {
    scene,
    requestedScene,
    routeWorldPosition,
    hexRealmPosition: resolveHexRealmPosition(scene, routeWorldPosition),
    hexCameraTarget: scene === "hex" ? "keep-center" : null,
    spectate: playRoute !== null && resolveSpectateIntent(location),
    isCanonical: playRoute !== null,
    playRoute,
  };
};
