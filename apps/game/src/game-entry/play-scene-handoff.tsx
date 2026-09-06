import { usePlayRouteBootSnapshot } from "@/game-entry/play-route-boot";
import { usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { buildMapResumeHref } from "@/play/navigation/play-route-boot-normalization";
import { buildPlayHref, parsePlayRoute } from "@/play/navigation/play-route";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import { Position } from "@bibliothecadao/eternum";
import { usePlayerStructures } from "@bibliothecadao/react";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const PlaySceneHandoff = () => {
  const snapshot = usePlayRouteBootSnapshot();
  const readiness = usePlayRouteReadinessStore();
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const playerStructures = usePlayerStructures();
  const navigate = useNavigate();
  const location = useLocation();
  const worldmapReadyMilestoneRef = useRef(false);
  const handoffStartedRef = useRef(false);
  const overlayDismissedRef = useRef(false);

  const playRoute = useMemo(() => parsePlayRoute(location), [location.pathname, location.search]);
  const fallbackWorldPosition = useMemo(() => {
    if (playerStructures.length === 0) {
      return null;
    }

    const first = playerStructures[0];
    const normalized = new Position({
      x: first.position.x,
      y: first.position.y,
    }).getNormalized();

    return {
      col: normalized.x,
      row: normalized.y,
    };
  }, [playerStructures]);

  useEffect(() => {
    if (playRoute == null || snapshot.resolvedRequest == null || snapshot.resolvedRequest.entryMode !== "player") {
      return;
    }

    if (
      playRoute.scene !== "map" ||
      playRoute.col !== null ||
      playRoute.row !== null ||
      fallbackWorldPosition == null
    ) {
      return;
    }

    navigate(
      buildMapResumeHref({
        route: playRoute,
        resumeScene: playRoute.resumeScene ?? null,
        col: fallbackWorldPosition.col,
        row: fallbackWorldPosition.row,
      }),
      { replace: true },
    );
    window.dispatchEvent(new Event("urlChanged"));
  }, [fallbackWorldPosition, navigate, playRoute, snapshot.resolvedRequest]);

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
      snapshot.resolvedRequest?.resumeScene == null ||
      !readiness.worldmapConverged ||
      handoffStartedRef.current
    ) {
      return;
    }

    if (playRoute.scene !== "map" || playRoute.bootMode !== "map-first") {
      return;
    }

    handoffStartedRef.current = true;
    markGameEntryMilestone("worldmap-navigation-started");
    navigate(
      buildPlayHref({
        ...playRoute,
        scene: snapshot.resolvedRequest.resumeScene,
        bootMode: "map-first",
        resumeScene: snapshot.resolvedRequest.resumeScene,
      }),
      { replace: true },
    );
    window.dispatchEvent(new Event("urlChanged"));
  }, [readiness.worldmapConverged, navigate, playRoute, snapshot.resolvedRequest]);

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
