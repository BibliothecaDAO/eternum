import clsx from "clsx";
import { usePlayRouteBootSnapshot } from "@/game-entry/play-route-boot";
import { usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { buildMapResumeHref } from "@/play/navigation/play-route-boot-normalization";
import { buildPlayHref, parsePlayRoute } from "@/play/navigation/play-route";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import { BootLoaderShell } from "@/ui/modules/boot-loader";
import { Position } from "@bibliothecadao/eternum";
import { usePlayerStructures } from "@bibliothecadao/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const SAFETY_TIMEOUT_MS = 15_000;
const SLOW_THRESHOLD_MS = 8_000;
const TICK_INTERVAL_MS = 250;

export const GameLoadingOverlay = () => {
  const snapshot = usePlayRouteBootSnapshot();
  const readiness = usePlayRouteReadinessStore();
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const mapLoading = useUIStore((state) => state.loadingStates[LoadingStateKey.Map]);
  const playerStructures = usePlayerStructures();
  const navigate = useNavigate();
  const location = useLocation();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [didSafetyTimeout, setDidSafetyTimeout] = useState(false);
  const startedAt = useRef(0);
  const worldmapReadyMilestoneRef = useRef(false);
  const worldmapFetchCompletedMilestoneRef = useRef(false);
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
  const hasWorldmapHydrated = readiness.worldmapReady && !mapLoading;
  const isFinalSceneReady =
    snapshot.resolvedRequest?.resumeScene === "hex"
      ? readiness.hexReady
      : snapshot.resolvedRequest?.resumeScene === "travel"
        ? readiness.fastTravelReady
        : hasWorldmapHydrated;
  const isReady = snapshot.phase === "ready" || isFinalSceneReady;

  useEffect(() => {
    markGameEntryMilestone("overlay-mounted");
  }, []);

  useEffect(() => {
    startedAt.current = Date.now();
    const intervalId = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt.current);
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [snapshot.bootToken]);

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
    if (!hasWorldmapHydrated || worldmapFetchCompletedMilestoneRef.current) {
      return;
    }

    worldmapFetchCompletedMilestoneRef.current = true;
    markGameEntryMilestone("worldmap-fetch-completed");
  }, [hasWorldmapHydrated]);

  useEffect(() => {
    if (
      playRoute == null ||
      snapshot.resolvedRequest?.resumeScene == null ||
      !hasWorldmapHydrated ||
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
  }, [hasWorldmapHydrated, navigate, playRoute, snapshot.resolvedRequest]);

  const dismissOverlay = useCallback(() => {
    if (overlayDismissedRef.current) {
      return;
    }

    overlayDismissedRef.current = true;
    markGameEntryMilestone("overlay-ready");
    markGameEntryMilestone("overlay-dismissed");
    window.setTimeout(() => {
      setShowBlankOverlay(false);
      if (playRoute && playRoute.bootMode === "map-first" && playRoute.resumeScene) {
        navigate(
          buildPlayHref({
            ...playRoute,
            bootMode: "direct",
            resumeScene: null,
          }),
          { replace: true },
        );
      }
      markGameEntryMilestone("world-interactive");
    }, 0);
  }, [navigate, playRoute, setShowBlankOverlay]);

  useEffect(() => {
    if (!isReady || finalReadyMilestoneRef.current) {
      return;
    }

    finalReadyMilestoneRef.current = true;
    dismissOverlay();
  }, [dismissOverlay, isReady]);

  useEffect(() => {
    setDidSafetyTimeout(false);
    const timeoutId = window.setTimeout(() => {
      if (!overlayDismissedRef.current) {
        setDidSafetyTimeout(true);
      }
    }, SAFETY_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [snapshot.bootToken]);

  const isSlow = !isReady && elapsedMs >= SLOW_THRESHOLD_MS;
  const progress = isReady ? 100 : Math.max(snapshot.progress, isHandingOffScene ? 97 : isWaitingForWorldmap ? 92 : 82);
  const statements = useMemo(() => {
    if (isReady) {
      return ["Your realm awaits."];
    }

    if (didSafetyTimeout) {
      return ["World map startup is still blocked."];
    }

    if (isHandingOffScene) {
      return ["Crossing into the requested scene..."];
    }

    if (isSlow) {
      return ["The realm is vast — still gathering intel..."];
    }

    if (isWaitingForWorldmap) {
      return ["Assembling the known world..."];
    }

    return ["Charting the world state..."];
  }, [didSafetyTimeout, isHandingOffScene, isReady, isSlow, isWaitingForWorldmap]);

  const tasks = snapshot.tasks.length > 0 ? snapshot.tasks : [];
  const overlayTitle = "Entering the Realm";
  const activeStatement = statements[0] ?? "Rendering the world map...";

  return (
    <BootLoaderShell
      className="absolute inset-0 z-[110]"
      panelClassName="max-w-[30rem] px-6 py-7 sm:px-8 sm:py-8"
      mode="determinate"
      progress={progress}
      title={overlayTitle}
      subtitle={activeStatement}
      caption="World Sync"
      detail={
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gold/10 pb-3 font-['Space_Grotesk',ui-sans-serif,system-ui,sans-serif] text-xs uppercase tracking-[0.28em] text-gold/45">
            <span>World handoff</span>
            <span className="tabular-nums">{Math.max(0, Math.min(100, Math.round(progress)))}%</span>
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
          {didSafetyTimeout ? (
            <p className="text-xs leading-relaxed text-red-200/80">
              The world is still blocked. This usually means world map readiness or the final scene handoff did not
              complete.
            </p>
          ) : null}
        </div>
      }
    />
  );
};
