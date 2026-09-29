import { usePlayRouteBootSnapshot } from "@/game-entry/play-route-boot";
import { usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { buildMapResumeHref } from "@/play/navigation/play-route-boot-normalization";
import { buildPlayHref, parsePlayRoute } from "@/play/navigation/play-route";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import { Position } from "@bibliothecadao/eternum";
import { usePlayerStructures } from "@/hooks/helpers/use-structures";
import { useFactView } from "@/hooks/use-fact-view";
import { gameStructuresView } from "@/sync/fact-views";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { resolveHexHandoff } from "./scene-handoff-target";

export const PlaySceneHandoff = () => {
  const snapshot = usePlayRouteBootSnapshot();
  const readiness = usePlayRouteReadinessStore();
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const isSpectating = useUIStore((state) => state.isSpectating);
  const returnPosition = useUIStore((state) => state.worldMapReturnPosition);
  const playerStructures = usePlayerStructures();
  const gameStructures = useFactView(gameStructuresView);
  const navigate = useNavigate();
  const location = useLocation();
  const worldmapReadyMilestoneRef = useRef(false);
  const handoffStartedRef = useRef(false);
  const overlayDismissedRef = useRef(false);

  const playRoute = useMemo(() => parsePlayRoute(location), [location.pathname, location.search]);
  // A player's route with no hex opens the map on their first structure's site.
  useEffect(() => {
    if (playRoute == null || snapshot.resolvedRequest == null || snapshot.resolvedRequest.entryMode !== "player") {
      return;
    }

    const first = playerStructures[0];
    if (playRoute.scene !== "map" || playRoute.col !== null || playRoute.row !== null || first === undefined) {
      return;
    }

    const site = Position.fromContract({ x: first.position.x, y: first.position.y }).getNormalized();
    navigate(
      buildMapResumeHref({
        route: playRoute,
        resumeScene: playRoute.resumeScene ?? null,
        col: site.x,
        row: site.y,
      }),
      { replace: true },
    );
    window.dispatchEvent(new Event("urlChanged"));
  }, [navigate, playRoute, playerStructures, snapshot.resolvedRequest]);

  useEffect(() => {
    if (!readiness.worldmapReady || worldmapReadyMilestoneRef.current) {
      return;
    }

    worldmapReadyMilestoneRef.current = true;
    markGameEntryMilestone("worldmap-scene-ready");
    markGameEntryMilestone("renderer-scene-ready");
  }, [readiness.worldmapReady]);

  useEffect(() => {
    if (
      playRoute == null ||
      snapshot.resolvedRequest?.resumeScene !== "hex" ||
      !readiness.worldmapConverged ||
      handoffStartedRef.current
    ) {
      return;
    }

    if (playRoute.scene !== "map" || playRoute.bootMode !== "map-first") {
      return;
    }

    // The local view opens on a realm: the map waits until the entry knows which, and keeps the entry when there is
    // none to open.
    const handoff = resolveHexHandoff({
      entryMode: snapshot.resolvedRequest.entryMode,
      structureEntityId,
      isSpectating,
      returnPosition,
      openableStructures:
        snapshot.resolvedRequest.entryMode === "player" ? playerStructures.length : gameStructures.length,
    });
    if (handoff.kind === "wait") return;

    handoffStartedRef.current = true;
    if (handoff.kind === "stay-on-map") {
      navigate(buildPlayHref({ ...playRoute, bootMode: "direct", resumeScene: null }), { replace: true });
      window.dispatchEvent(new Event("urlChanged"));
      return;
    }
    markGameEntryMilestone("worldmap-navigation-started");
    navigate(
      buildPlayHref({
        ...playRoute,
        ...handoff.hex,
        scene: "hex",
        bootMode: "map-first",
        resumeScene: "hex",
      }),
      { replace: true },
    );
    window.dispatchEvent(new Event("urlChanged"));
  }, [
    readiness.worldmapConverged,
    navigate,
    playRoute,
    snapshot.resolvedRequest,
    structureEntityId,
    isSpectating,
    returnPosition,
    playerStructures.length,
    gameStructures.length,
  ]);

  useEffect(() => {
    if (snapshot.phase !== "ready" || overlayDismissedRef.current) return;
    overlayDismissedRef.current = true;
    setShowBlankOverlay(false);
    const settledRoute = parsePlayRoute(window.location);
    if (settledRoute?.bootMode === "map-first" && settledRoute.resumeScene) {
      navigate(buildPlayHref({ ...settledRoute, bootMode: "direct", resumeScene: null }), { replace: true });
    }
    markGameEntryMilestone("overlay-ready");
    markGameEntryMilestone("overlay-dismissed");
    markGameEntryMilestone("world-interactive");
  }, [navigate, setShowBlankOverlay, snapshot.phase]);

  return null;
};
