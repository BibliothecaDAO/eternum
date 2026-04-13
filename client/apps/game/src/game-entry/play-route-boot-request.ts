import { parsePlayRoute, type PlayScene } from "@/play/navigation/play-route";
import { resolvePlaySceneTarget } from "@/play/navigation/play-scene-target";

export interface ResolvedPlayBootRequest {
  bootScene: PlayScene;
  chain: string;
  entryMode: "player" | "spectator";
  fallbackPolicy: "route" | "synced-structure";
  requestedScene: PlayScene;
  resumeScene: PlayScene | null;
  routeWorldPosition: { col: number; row: number } | null;
  worldName: string;
}

type LocationLike = Pick<Location, "pathname" | "search">;

export const resolvePlayBootRequest = (
  location: LocationLike,
  { fastTravelEnabled }: { fastTravelEnabled: boolean },
): ResolvedPlayBootRequest | null => {
  const route = parsePlayRoute(location);
  if (!route) {
    return null;
  }

  const routeWorldPosition =
    typeof route.col === "number" && typeof route.row === "number" ? { col: route.col, row: route.row } : null;
  const requestedScene = route.bootMode === "map-first" ? (route.resumeScene ?? route.scene) : route.scene;
  const resolvedScene = resolvePlaySceneTarget(requestedScene, fastTravelEnabled);
  const resumeScene = route.bootMode === "map-first" && resolvedScene !== "map" ? resolvedScene : null;

  return {
    bootScene: route.bootMode === "map-first" ? "map" : resolvedScene,
    chain: route.chain,
    entryMode: route.spectate ? "spectator" : "player",
    fallbackPolicy: routeWorldPosition ? "route" : "synced-structure",
    requestedScene,
    resumeScene,
    routeWorldPosition,
    worldName: route.worldName,
  };
};
