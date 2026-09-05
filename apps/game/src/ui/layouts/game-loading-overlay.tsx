import clsx from "clsx";
import { usePlayRouteBootSnapshot } from "@/game-entry/play-route-boot";
import { usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { buildMapResumeHref } from "@/play/navigation/play-route-boot-normalization";
import { buildPlayHref, parsePlayRoute } from "@/play/navigation/play-route";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import { BootDebugPanel, BootLoaderShell } from "@/ui/modules/boot-loader";
import { Position } from "@bibliothecadao/eternum";
import { usePlayerStructures } from "@bibliothecadao/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const GameLoadingOverlay = () => {
  const snapshot = usePlayRouteBootSnapshot();
  const readiness = usePlayRouteReadinessStore();
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const playerStructures = usePlayerStructures();
  const navigate = useNavigate();
  const location = useLocation();
  const worldmapReadyMilestoneRef = useRef(false);
  const finalReadyMilestoneRef = useRef(false);
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

  const isWaitingForWorldmap = snapshot.phase === "wait_worldmap_ready";
  const isHandingOffScene = snapshot.phase === "handoff_scene";
  const hasWorldmapCriticalPass = readiness.worldmapReady;
  const hasWorldmapConverged = readiness.worldmapConverged;
  const isFinalSceneReady =
    snapshot.resolvedRequest?.resumeScene === "hex"
      ? readiness.hexReady
      : snapshot.resolvedRequest?.resumeScene === "travel"
        ? readiness.fastTravelReady
        : hasWorldmapCriticalPass;
  const isReady = snapshot.phase === "ready" || isFinalSceneReady;

  useEffect(() => {
    markGameEntryMilestone("overlay-mounted");
  }, []);

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
      !hasWorldmapConverged ||
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
  }, [hasWorldmapConverged, navigate, playRoute, snapshot.resolvedRequest]);

  const dismissOverlay = useCallback(() => {
    if (overlayDismissedRef.current) {
      return;
    }

    overlayDismissedRef.current = true;
    markGameEntryMilestone("overlay-ready");
    markGameEntryMilestone("overlay-dismissed");
    window.setTimeout(() => {
      setShowBlankOverlay(false);
      // Read the route now, not at capture time: the handoff may have moved the URL since this callback was made.
      const settledRoute = parsePlayRoute(window.location);
      if (settledRoute && settledRoute.bootMode === "map-first" && settledRoute.resumeScene) {
        navigate(
          buildPlayHref({
            ...settledRoute,
            bootMode: "direct",
            resumeScene: null,
          }),
          { replace: true },
        );
      }
      markGameEntryMilestone("world-interactive");
    }, 0);
  }, [navigate, setShowBlankOverlay]);

  useEffect(() => {
    if (!isReady || finalReadyMilestoneRef.current) {
      return;
    }

    finalReadyMilestoneRef.current = true;
    dismissOverlay();
  }, [dismissOverlay, isReady]);

  const activeStatement = isReady
    ? "Your realm awaits."
    : isHandingOffScene
      ? "Preparing your destination…"
      : isWaitingForWorldmap
        ? "Preparing terrain and units…"
        : "Connecting to the world…";

  const tasks = snapshot.tasks.length > 0 ? snapshot.tasks : [];
  const currentTaskLabel = tasks.find((task) => task.status === "running")?.label ?? snapshot.currentTask;
  const overlayTitle = "Entering the Realm";

  return (
    <BootLoaderShell
      className="absolute inset-0 z-[110]"
      panelClassName="max-w-[30rem] px-6 py-7 sm:px-8 sm:py-8"
      mode="indeterminate"
      title={overlayTitle}
      subtitle={activeStatement}
      caption="World Sync"
      detail={
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gold/10 pb-3 font-['Space_Grotesk',ui-sans-serif,system-ui,sans-serif] text-xs uppercase tracking-[0.28em] text-gold/45">
            <span>Preparing the world</span>
            <span className="tabular-nums">
              {tasks.filter((task) => task.status === "complete").length} / {tasks.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {tasks.map((task) => {
              const isRunning = task.status === "running";
              const isComplete = task.status === "complete";
              const statusTone = isComplete
                ? "border-gold/30 bg-gold/12 text-gold"
                : isRunning
                  ? "border-gold/20 bg-gold/6 text-gold/80"
                  : "border-gold/8 bg-gold/3 text-gold/30";

              return (
                <div
                  key={task.id}
                  className={clsx(
                    "flex items-center justify-between gap-4 rounded-lg border border-gold/15 bg-black/20 px-4 py-2.5 transition-all duration-300",
                    isRunning && "border-l-2 border-l-gold/50",
                  )}
                >
                  <span className="text-sm text-gold/80">{task.label}</span>
                  <span
                    className={clsx(
                      "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
                      statusTone,
                    )}
                  >
                    {task.status === "complete" ? "Done" : task.status === "running" ? "Active" : "Pending"}
                  </span>
                </div>
              );
            })}
          </div>
          {import.meta.env.DEV ? <BootDebugPanel currentTaskLabel={currentTaskLabel} /> : null}
        </div>
      }
    />
  );
};
