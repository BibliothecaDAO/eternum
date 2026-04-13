import { Position, configManager } from "@bibliothecadao/eternum";

import { parsePlayRoute, type PlayRouteDescriptor, type PlayScene } from "./play-route";

type LocationLike = Pick<Location, "pathname" | "search">;

export interface PlayRouteWorldPosition {
  col: number;
  row: number;
}

export interface ResolvedPlayRouteTarget {
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
const CONTRACT_SPACE_RANGE_RADIUS = 1_000_000;

export const normalizeWorldMapRoutePosition = (
  position: Partial<PlayRouteWorldPosition> | null | undefined,
  options: { mapCenter?: number | null } = {},
): PlayRouteWorldPosition | null => {
  if (!position || !isFiniteCoordinate(position.col) || !isFiniteCoordinate(position.row)) {
    return null;
  }

  const resolvedMapCenter =
    typeof options.mapCenter === "number" && Number.isFinite(options.mapCenter)
      ? options.mapCenter
      : configManager.getMapCenter();
  const appearsToBeContractPosition =
    Math.abs(position.col - resolvedMapCenter) <= CONTRACT_SPACE_RANGE_RADIUS &&
    Math.abs(position.row - resolvedMapCenter) <= CONTRACT_SPACE_RANGE_RADIUS;

  if (!appearsToBeContractPosition) {
    return {
      col: position.col,
      row: position.row,
    };
  }

  return {
    col: position.col - resolvedMapCenter,
    row: position.row - resolvedMapCenter,
  };
};

const resolveRouteWorldPositionFromPlayRoute = (
  playRoute: PlayRouteDescriptor | null,
): PlayRouteWorldPosition | null => {
  if (!playRoute) {
    return null;
  }

  return normalizeWorldMapRoutePosition({
    col: playRoute.col,
    row: playRoute.row,
  });
};

export const resolvePlaySceneTarget = (
  requestedScene: PlayScene | null | undefined,
  fastTravelEnabled: boolean,
): PlayScene => {
  if (requestedScene === "travel" && !fastTravelEnabled) {
    return "map";
  }

  return requestedScene ?? "map";
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

  const contractPosition = new Position({ x: routeWorldPosition.col, y: routeWorldPosition.row }).getContract();
  return {
    col: contractPosition.x,
    row: contractPosition.y,
  };
};

export const resolvePlayRouteTarget = (
  location: LocationLike,
  { fastTravelEnabled }: { fastTravelEnabled: boolean },
): ResolvedPlayRouteTarget => {
  const playRoute = parsePlayRoute(location);
  const routeWorldPosition = resolveRouteWorldPositionFromPlayRoute(playRoute);
  const requestedScene = playRoute?.scene ?? null;
  const scene = resolvePlaySceneTarget(requestedScene, fastTravelEnabled);

  return {
    scene,
    requestedScene,
    routeWorldPosition,
    hexRealmPosition: resolveHexRealmPosition(scene, routeWorldPosition),
    hexCameraTarget: scene === "hex" ? "keep-center" : null,
    spectate: playRoute?.spectate ?? false,
    isCanonical: playRoute !== null,
    playRoute,
  };
};
