import { isExplicitSpectateSession, resolveSpectateIntent } from "@/utils/spectator-session";
import { buildPlayHref, parsePlayRoute, type PlayRouteDescriptor, type PlayScene } from "./play-route";

type LocationLike = Pick<Location, "pathname" | "search">;

const DEFAULT_PLAYER_RESUME_SCENE: PlayScene = "hex";

const buildCanonicalMapFirstRoute = (
  route: PlayRouteDescriptor,
  resumeScene: PlayScene,
  spectate: boolean,
  coordinates?: { col: number | null; row: number | null },
) => {
  return buildPlayHref({
    ...route,
    scene: "map",
    col: coordinates?.col ?? route.col,
    row: coordinates?.row ?? route.row,
    spectate,
    bootMode: "map-first",
    resumeScene,
  });
};

// A hex or travel entry boots map-first for players and spectators alike: the world map readies first and hands
// off, which is the only path a direct hex link completes on.
const shouldBootMapFirst = (route: PlayRouteDescriptor): boolean => route.scene === "hex" || route.scene === "travel";

const buildCanonicalPlayerBootHref = ({
  route,
  resumeScene,
  spectate,
  coordinates,
}: {
  route: PlayRouteDescriptor;
  resumeScene?: PlayScene | null;
  spectate: boolean;
  coordinates?: { col: number | null; row: number | null };
}): string => {
  return buildCanonicalMapFirstRoute(
    route,
    resumeScene ?? route.scene ?? DEFAULT_PLAYER_RESUME_SCENE,
    spectate,
    coordinates,
  );
};

export const normalizePlayBootLocation = (location: LocationLike): string | null => {
  const route = parsePlayRoute(location);
  const spectate = resolveSpectateIntent(location);
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
      spectate,
    });
  }

  return buildCanonicalPlayerBootHref({
    route,
    resumeScene: route.scene,
    spectate,
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

  return buildCanonicalMapFirstRoute(route, resumeScene ?? DEFAULT_PLAYER_RESUME_SCENE, isExplicitSpectateSession(), {
    col,
    row,
  });
};
