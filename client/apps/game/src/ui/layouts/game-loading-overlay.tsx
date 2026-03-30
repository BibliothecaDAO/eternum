import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { BootLoaderShell, useBootDocumentState } from "@/ui/modules/boot-loader";
import { Position } from "@bibliothecadao/eternum";
import { usePlayerStructures } from "@bibliothecadao/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BootstrapTask } from "@/hooks/context/use-eager-bootstrap";
import { getSceneWarmupProgress, resolveEntryOverlayPhase } from "./game-loading-overlay.utils";
import { useLocation, useNavigate } from "react-router-dom";

const SAFETY_TIMEOUT_MS = 15_000;
const SLOW_THRESHOLD_MS = 8_000;
const TICK_INTERVAL_MS = 250;
const HANDOFF_PROGRESS = 76;
// Time to wait after tile data loads before dismissing.
// The bounds subscription still needs to stream structures and the
// world update listener needs to process them into visible state.
const POST_WORLD_MAP_LOAD_DELAY_MS = 3_000;

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

  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const isSpectating = useUIStore((state) => state.isSpectating);
  const worldMapReturnPosition = useUIStore((state) => state.worldMapReturnPosition);
  const mapLoading = useUIStore((state) => state.loadingStates[LoadingStateKey.Map]);
  const playerStructures = usePlayerStructures();
  const hasDismissed = useRef(false);
  const hasSeenMapLoading = useRef(false);
  const startedAt = useRef(0);
  const hasStartedPlayerFlow = useRef(false);
  const hasStartedSpectatorFlow = useRef(false);
  const hasQueuedWorldMapReady = useRef(false);
  const worldMapReadyTimeoutId = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isOnWorldMapRoute = location.pathname.startsWith("/play/map");
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
      setTimeout(() => setShowBlankOverlay(false), delayMs);
    },
    [setShowBlankOverlay],
  );

  const markWorldMapReady = useCallback(
    (delayMs: number) => {
      if (hasQueuedWorldMapReady.current) {
        return;
      }

      hasQueuedWorldMapReady.current = true;
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

    const first = playerStructures[0];
    const setStructureEntityId = useUIStore.getState().setStructureEntityId;
    setStructureEntityId(first.entityId, {
      spectator: false,
      worldMapPosition: targetWorldMapPosition,
    });

    const url = `/play/map?col=${targetWorldMapPosition.col}&row=${targetWorldMapPosition.row}`;
    navigate(url);
    window.dispatchEvent(new Event("urlChanged"));
  }, [playerStructures, isOnWorldMapRoute, isSpectating, navigate, targetWorldMapPosition]);

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

    // Map loading went true → false: initial tile fetch complete.
    // Wait additional time for the bounds subscription to stream
    // Structure entities and for the map to render them.
    if (hasSeenMapLoading.current && !mapLoading) {
      markWorldMapReady(POST_WORLD_MAP_LOAD_DELAY_MS);
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
        hasDismissed.current = true;
        setShowBlankOverlay(false);
      }
    }, SAFETY_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [setShowBlankOverlay]);

  const isSlow = !isReady && elapsedMs >= SLOW_THRESHOLD_MS;
  const hasNavigatedToTarget = isSpectating
    ? elapsedMs >= TICK_INTERVAL_MS
    : isOnWorldMapRoute || playerStructures.length > 0;
  const phase = resolveEntryOverlayPhase({
    isReady,
    hasNavigated: hasNavigatedToTarget,
    isSlow,
  });

  const progress = useMemo(() => {
    if (phase === "ready") return 100;
    if (phase === "handoff") return HANDOFF_PROGRESS;
    return getSceneWarmupProgress(elapsedMs);
  }, [phase, elapsedMs]);

  const statements = useMemo(() => {
    if (phase === "ready") return ["World view ready!"];
    if (phase === "slow") return ["Taking longer than usual, still syncing...", "Still charting nearby territory..."];
    if (phase === "handoff") return ["Opening your world map..."];
    return ["Rendering the world map...", "Charting nearby territory...", "Locating your realm..."];
  }, [phase]);

  const tasks = useMemo<BootstrapTask[]>(() => {
    if (phase === "ready") {
      return [
        { id: "handoff", label: "Transitioning to the world map", status: "complete" },
        { id: "render", label: "Rendering terrain and structures", status: "complete" },
        { id: "final", label: "Final checks", status: "complete" },
      ];
    }

    if (phase === "handoff") {
      return [
        { id: "handoff", label: "Transitioning to the world map", status: "running" },
        { id: "render", label: "Rendering terrain and structures", status: "pending" },
        { id: "final", label: "Final checks", status: "pending" },
      ];
    }

    if (phase === "slow") {
      return [
        { id: "handoff", label: "Transitioning to the world map", status: "complete" },
        { id: "render", label: "Rendering terrain and structures", status: "running" },
        { id: "final", label: "Final checks", status: "running" },
      ];
    }

    return [
      { id: "handoff", label: "Transitioning to the world map", status: "complete" },
      { id: "render", label: "Rendering terrain and structures", status: "running" },
      { id: "final", label: "Final checks", status: "pending" },
    ];
  }, [phase]);

  const overlayTitle = "Entering World View";
  const activeStatement = statements[0] ?? "Rendering the world map...";

  return (
    <BootLoaderShell
      className="absolute inset-0 z-[110]"
      panelClassName="max-w-[32rem] px-5 py-6 sm:px-6 sm:py-7"
      mode="determinate"
      progress={progress}
      title={overlayTitle}
      subtitle={activeStatement}
      caption="Step 2 of 2"
      detail={
        <div className="space-y-4">
          <div className="flex items-center justify-between font-['Space_Grotesk',ui-sans-serif,system-ui,sans-serif] text-xs uppercase tracking-[0.28em] text-gold/45">
            <span>World handoff</span>
            <span>{Math.max(0, Math.min(100, Math.round(progress)))}%</span>
          </div>
          <div className="space-y-3">
            {tasks.map((task) => {
              const statusTone =
                task.status === "complete"
                  ? "border-gold/40 bg-gold/15 text-gold"
                  : task.status === "running"
                    ? "border-gold/35 bg-gold/10 text-gold/90"
                    : "border-white/10 bg-white/5 text-[rgba(236,224,194,0.45)]";

              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/25 px-4 py-3"
                >
                  <span className="font-['Space_Grotesk',ui-sans-serif,system-ui,sans-serif] text-sm text-[rgba(236,224,194,0.84)]">
                    {task.label}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 font-['Space_Grotesk',ui-sans-serif,system-ui,sans-serif] text-[0.62rem] uppercase tracking-[0.22em] ${statusTone}`}
                  >
                    {task.status}
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
