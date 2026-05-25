import { buildPlayHref, parsePlayRoute, type PlayRouteDescriptor, type PlayScene } from "./play-route";

type LocationLike = Pick<Location, "pathname" | "search">;

const DEFAULT_PLAYER_RESUME_SCENE: PlayScene = "hex";

const buildCanonicalMapFirstRoute = (
  route: PlayRouteDescriptor,
  resumeScene: PlayScene,
  coordinates?: { col: number | null; row: number | null },
) => {
  return buildPlayHref({
    ...route,
    scene: "map",
    col: coordinates?.col ?? route.col,
    row: coordinates?.row ?? route.row,
    bootMode: "map-first",
    resumeScene,
  });
};

const shouldBootMapFirst = (route: PlayRouteDescriptor): boolean => {
  if (route.spectate) {
    return false;
  }

  return route.scene === "hex" || route.scene === "travel";
};

const buildCanonicalPlayerBootHref = ({
  route,
  resumeScene,
  coordinates,
}: {
  route: PlayRouteDescriptor;
  resumeScene?: PlayScene | null;
  coordinates?: { col: number | null; row: number | null };
}): string => {
  return buildCanonicalMapFirstRoute(route, resumeScene ?? route.scene ?? DEFAULT_PLAYER_RESUME_SCENE, coordinates);
};

export const normalizePlayBootLocation = (location: LocationLike): string | null => {
  const route = parsePlayRoute(location);
  if (!route || !shouldBootMapFirst(route)) {
    return null;
  }

  if (route.bootMode === "map-first") {
    return null;
  }

  if (route.col === null || route.row === null) {
    return buildCanonicalPlayerBootHref({
      route: {
        ...route,
        col: null,
        row: null,
      },
      resumeScene: route.scene,
    });
  }

  return buildCanonicalPlayerBootHref({
    route,
    resumeScene: route.scene,
  });
};

export const buildMapResumeHref = ({
  route,
  resumeScene,
  col,
  row,
}: {
  route: PlayRouteDescriptor;
  resumeScene?: PlayScene | null;
  col: number | null;
  row: number | null;
}) => {
  if (resumeScene === null) {
    return buildPlayHref({
      ...route,
      bootMode: "direct",
      col,
      resumeScene: null,
      row,
      scene: "map",
    });
  }

  return buildCanonicalMapFirstRoute(route, resumeScene ?? DEFAULT_PLAYER_RESUME_SCENE, { col, row });
};
