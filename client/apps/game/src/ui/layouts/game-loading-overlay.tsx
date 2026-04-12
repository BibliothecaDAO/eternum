import clsx from "clsx";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { buildPlayHref, parsePlayRoute } from "@/play/navigation/play-route";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import { BootLoaderShell, useBootDocumentState } from "@/ui/modules/boot-loader";
import { Position } from "@bibliothecadao/eternum";
import { usePlayerStructures } from "@bibliothecadao/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BootstrapTask } from "@/hooks/context/use-eager-bootstrap";
import {
  getSceneWarmupProgress,
  resolveEntryOverlayPhase,
  waitForWorldmapSceneReady,
} from "./game-loading-overlay.utils";
import { useLocation, useNavigate } from "react-router-dom";

const SAFETY_TIMEOUT_MS = 15_000;
const SLOW_THRESHOLD_MS = 8_000;
const TICK_INTERVAL_MS = 250;
const HANDOFF_PROGRESS = 76;
const WORLDMAP_READY_TIMEOUT_MS = 1_200;

type WorldMapPosition = {
  col: number;
  row: number;
};

const isFiniteWorldMapPosition = (
  position: { col?: number | null; row?: number | null } | null | undefined,
): position is WorldMapPosition => {
  return (
    position != null &&
    typeof position.col === "number" &&
    Number.isFinite(position.col) &&
    typeof position.row === "number" &&
    Number.isFinite(position.row)
  );
};

/**
 * Loading overlay shown while game data syncs after <World> mounts.
 *
 * For players:
 *   Waits for structures in RECS, navigates to the player's realm on the world map,
 *   then dismisses once the map finishes its initial fetch.
 *
 * For spectators:
 *   Waits for the world map's initial Torii fetch to complete, then dismisses.
 *
 * Falls back to a safety timeout if neither signal fires.
 */
export const GameLoadingOverlay = () => {
  useBootDocumentState("app-loading");

  useEffect(() => {
    markGameEntryMilestone("overlay-mounted");
  }, []);

  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const isSpectating = useUIStore((state) => state.isSpectating);
  const worldMapReturnPosition = useUIStore((state) => state.worldMapReturnPosition);
  const mapLoading = useUIStore((state) => state.loadingStates[LoadingStateKey.Map]);
  const playerStructures = usePlayerStructures();
  const hasDismissed = useRef(false);
  const hasSeenMapLoading = useRef(false);
  const hasSeenWorldmapReady = useRef(false);
  const isWaitingForWorldmapReady = useRef(false);
  const startedAt = useRef(0);
  const hasStartedPlayerFlow = useRef(false);
  const hasStartedSpectatorFlow = useRef(false);
  const hasQueuedWorldMapReady = useRef(false);
  const worldMapReadyTimeoutId = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [didSafetyTimeout, setDidSafetyTimeout] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const canonicalPlayRoute = useMemo(() => parsePlayRoute(location), [location]);
  const isOnWorldMapRoute = canonicalPlayRoute?.scene === "map" || location.pathname.startsWith("/play/map");
  const targetWorldMapPosition = useMemo<WorldMapPosition | null>(() => {
    if (isSpectating && isFiniteWorldMapPosition(worldMapReturnPosition)) {
      return worldMapReturnPosition;
    }

    if (playerStructures.length === 0) {
      return null;
    }

    const first = playerStructures[0];
    const normalized = new Position({ x: first.position.x, y: first.position.y }).getNormalized();
    return { col: normalized.x, row: normalized.y };
  }, [isSpectating, playerStructures, worldMapReturnPosition]);

  const dismiss = useCallback(
    (delayMs: number) => {
      if (hasDismissed.current) return;
      hasDismissed.current = true;
      markGameEntryMilestone("overlay-dismissed");
      setTimeout(() => {
        markGameEntryMilestone("world-interactive");
        setShowBlankOverlay(false);
      }, delayMs);
    },
    [setShowBlankOverlay],
  );

  const markWorldMapReady = useCallback(
    (delayMs: number) => {
      if (hasQueuedWorldMapReady.current) {
        return;
      }

      hasQueuedWorldMapReady.current = true;
      markGameEntryMilestone("overlay-ready");
      worldMapReadyTimeoutId.current = window.setTimeout(() => {
        worldMapReadyTimeoutId.current = null;
        setIsReady(true);
      }, 0);
      dismiss(delayMs);
    },
    [dismiss],
  );

  useEffect(() => {
    startedAt.current = Date.now();

    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt.current);
    }, TICK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  // --- Player path: navigate to the world map centered on the first synced structure ---
  useEffect(() => {
    if (hasDismissed.current || isSpectating || hasStartedPlayerFlow.current) return;
    if (targetWorldMapPosition == null) return;

    if (isOnWorldMapRoute) {
      hasStartedPlayerFlow.current = true;
      return;
    }

    if (playerStructures.length === 0) return;

    hasStartedPlayerFlow.current = true;
    markGameEntryMilestone("player-structures-synced");

    const first = playerStructures[0];
    const setStructureEntityId = useUIStore.getState().setStructureEntityId;
    setStructureEntityId(first.entityId, {
      spectator: false,
      worldMapPosition: targetWorldMapPosition,
    });

    const url = canonicalPlayRoute
      ? buildPlayHref({
          ...canonicalPlayRoute,
          scene: "map",
          col: targetWorldMapPosition.col,
          row: targetWorldMapPosition.row,
          spectate: false,
        })
      : `/play/map?col=${targetWorldMapPosition.col}&row=${targetWorldMapPosition.row}`;
    markGameEntryMilestone("worldmap-navigation-started");
    navigate(url);
    window.dispatchEvent(new Event("urlChanged"));
  }, [canonicalPlayRoute, playerStructures, isOnWorldMapRoute, isSpectating, navigate, targetWorldMapPosition]);

  useEffect(() => {
    if (hasDismissed.current) return;

    const hasStartedWorldMapFlow = isSpectating ? hasStartedSpectatorFlow.current : hasStartedPlayerFlow.current;
    if (!hasStartedWorldMapFlow) {
      return;
    }

    if (hasSeenWorldmapReady.current || isWaitingForWorldmapReady.current) {
      return;
    }

    isWaitingForWorldmapReady.current = true;
    let cancelled = false;

    void (async () => {
      const didReceiveSceneReadySignal = await waitForWorldmapSceneReady(WORLDMAP_READY_TIMEOUT_MS);
      isWaitingForWorldmapReady.current = false;
      if (cancelled) {
        return;
      }

      hasSeenWorldmapReady.current = true;
      markGameEntryMilestone("worldmap-scene-ready");
      if (didReceiveSceneReadySignal) {
        markGameEntryMilestone("renderer-scene-ready");
      }
      setDidSafetyTimeout(false);

      if (!mapLoading) {
        markWorldMapReady(0);
      }
    })();

    return () => {
      cancelled = true;
      isWaitingForWorldmapReady.current = false;
    };
  }, [isSpectating, mapLoading, markWorldMapReady]);

  // --- World-map path: dismiss once the initial map fetch completes ---
  useEffect(() => {
    if (hasDismissed.current) return;

    if (isSpectating && !hasStartedSpectatorFlow.current) {
      hasStartedSpectatorFlow.current = true;
    }

    const hasStartedWorldMapFlow = isSpectating ? hasStartedSpectatorFlow.current : hasStartedPlayerFlow.current;
    if (!hasStartedWorldMapFlow) {
      return;
    }

    if (mapLoading) {
      hasSeenMapLoading.current = true;
    }

    if (hasSeenWorldmapReady.current && !mapLoading) {
      markGameEntryMilestone("worldmap-fetch-completed");
      markWorldMapReady(0);
    }
  }, [isSpectating, mapLoading, markWorldMapReady]);

  useEffect(() => {
    return () => {
      if (worldMapReadyTimeoutId.current !== null) {
        window.clearTimeout(worldMapReadyTimeoutId.current);
      }
    };
  }, []);

  // Safety timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasDismissed.current) {
        setDidSafetyTimeout(true);
      }
    }, SAFETY_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, []);

  const isSlow = !isReady && elapsedMs >= SLOW_THRESHOLD_MS;
  const hasNavigatedToTarget = isSpectating
    ? elapsedMs >= TICK_INTERVAL_MS
    : isOnWorldMapRoute || playerStructures.length > 0;
  const phase = resolveEntryOverlayPhase({
    isReady,
    hasNavigated: hasNavigatedToTarget,
    isSlow,
    didSafetyTimeout,
  });

  const progress = useMemo(() => {
    if (phase === "ready") return 100;
    if (phase === "handoff") return HANDOFF_PROGRESS;
    return getSceneWarmupProgress(elapsedMs);
  }, [phase, elapsedMs]);

  const statements = useMemo(() => {
    if (phase === "ready") return ["Your realm awaits."];
    if (phase === "timed_out") return ["World map startup is still blocked."];
    if (phase === "slow") return ["The realm is vast — still gathering intel..."];
    if (phase === "handoff") return ["Crossing into the world map..."];
    return ["Assembling the known world..."];
  }, [phase]);

  const tasks = useMemo<BootstrapTask[]>(() => {
    if (phase === "ready") {
      return [
        { id: "handoff", label: "World map located", status: "complete" },
        { id: "render", label: "Terrain & structures rendered", status: "complete" },
        { id: "final", label: "Realm synchronized", status: "complete" },
      ];
    }

    if (phase === "handoff") {
      return [
        { id: "handoff", label: "Locating world map", status: "running" },
        { id: "render", label: "Terrain & structures", status: "pending" },
        { id: "final", label: "Realm synchronization", status: "pending" },
      ];
    }

    if (phase === "slow") {
      return [
        { id: "handoff", label: "World map located", status: "complete" },
        { id: "render", label: "Rendering terrain & structures", status: "running" },
        { id: "final", label: "Synchronizing realm", status: "running" },
      ];
    }

    if (phase === "timed_out") {
      return [
        { id: "handoff", label: "World map located", status: "complete" },
        { id: "render", label: "Rendering terrain & structures", status: "running" },
        { id: "final", label: "Waiting for world interactivity", status: "running" },
      ];
    }

    return [
      { id: "handoff", label: "World map located", status: "complete" },
      { id: "render", label: "Rendering terrain & structures", status: "running" },
      { id: "final", label: "Realm synchronization", status: "pending" },
    ];
  }, [phase]);

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
                  <span
                    className={clsx(
                      "font-['Space_Grotesk',ui-sans-serif,system-ui,sans-serif] text-sm transition-colors duration-300",
                      isComplete
                        ? "text-[rgba(236,224,194,0.9)]"
                        : isRunning
                          ? "text-[rgba(236,224,194,0.84)]"
                          : "text-[rgba(236,224,194,0.45)]",
                    )}
                  >
                    {task.label}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 font-['Space_Grotesk',ui-sans-serif,system-ui,sans-serif] text-[0.6rem] uppercase tracking-[0.22em] transition-all duration-300 ${statusTone}`}
                  >
                    {task.status === "complete" ? "done" : task.status === "running" ? "syncing" : "waiting"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      }
    />
  );
};
