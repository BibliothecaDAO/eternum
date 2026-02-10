import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { Position } from "@bibliothecadao/eternum";
import { usePlayerStructures } from "@bibliothecadao/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BootstrapTask } from "@/hooks/context/use-eager-bootstrap";
import { BootstrapLoadingPanel } from "@/ui/layouts/bootstrap-loading/bootstrap-loading-panel";
import {
  getSceneWarmupProgress,
  resolveEntryOverlayPhase,
  waitForHexceptionGridReady,
} from "./game-loading-overlay.utils";
import { useNavigate } from "react-router-dom";

const SAFETY_TIMEOUT_MS = 15_000;
const SLOW_THRESHOLD_MS = 8_000;
const TICK_INTERVAL_MS = 250;
const HANDOFF_PROGRESS = 76;
const POST_HEX_READY_DELAY_MS = 250;
const HEXCEPTION_READY_TIMEOUT_MS = 6_000;
// Time to wait after tile data loads before dismissing (spectator path).
// Longer because the bounds subscription still needs to stream Structure
// entities and the WorldUpdateListener needs to process them into visuals.
const POST_MAP_LOAD_DELAY_MS = 3_000;

/**
 * Loading overlay shown while game data syncs after <World> mounts.
 *
 * For players:
 *   Waits for structures in RECS, navigates to the player's realm, then dismisses.
 *
 * For spectators:
 *   Waits for the world map's initial Torii fetch to complete, then dismisses.
 *
 * Falls back to a safety timeout if neither signal fires.
 */
export const GameLoadingOverlay = () => {
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const isSpectating = useUIStore((state) => state.isSpectating);
  const mapLoading = useUIStore((state) => state.loadingStates[LoadingStateKey.Map]);
  const playerStructures = usePlayerStructures();
  const hasDismissed = useRef(false);
  const hasSeenMapLoading = useRef(false);
  const startedAt = useRef(0);
  const hasStartedPlayerFlow = useRef(false);
  const hasStartedSpectatorFlow = useRef(false);
  const hasQueuedSpectatorReady = useRef(false);
  const spectatorReadyTimeoutId = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();

  const dismiss = useCallback(
    (delayMs: number) => {
      if (hasDismissed.current) return;
      hasDismissed.current = true;
      setTimeout(() => setShowBlankOverlay(false), delayMs);
    },
    [setShowBlankOverlay],
  );

  useEffect(() => {
    startedAt.current = Date.now();

    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt.current);
    }, TICK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  // --- Player path: navigate to first structure once it appears in RECS ---
  useEffect(() => {
    if (hasDismissed.current || isSpectating || hasStartedPlayerFlow.current) return;
    if (playerStructures.length === 0) return;

    hasStartedPlayerFlow.current = true;

    const first = playerStructures[0];
    const normalized = new Position({ x: first.position.x, y: first.position.y }).getNormalized();

    const setStructureEntityId = useUIStore.getState().setStructureEntityId;
    setStructureEntityId(first.entityId, {
      spectator: false,
      worldMapPosition: { col: normalized.x, row: normalized.y },
    });

    const targetCoords = { col: normalized.x, row: normalized.y };
    const ready = waitForHexceptionGridReady(targetCoords, HEXCEPTION_READY_TIMEOUT_MS);

    const url = `/play/hex?col=${normalized.x}&row=${normalized.y}`;
    navigate(url);
    window.dispatchEvent(new Event("urlChanged"));

    void ready.then(() => {
      setIsReady(true);
      dismiss(POST_HEX_READY_DELAY_MS);
    });
  }, [playerStructures, isSpectating, navigate, dismiss]);

  // --- Spectator path: dismiss once the world map finishes its initial fetch ---
  useEffect(() => {
    if (hasDismissed.current || !isSpectating) return;
    if (!hasStartedSpectatorFlow.current) {
      hasStartedSpectatorFlow.current = true;
    }

    if (mapLoading) {
      hasSeenMapLoading.current = true;
    }

    // Map loading went true → false: initial tile fetch complete.
    // Wait additional time for the bounds subscription to stream
    // Structure entities and for the map to render them.
    if (hasSeenMapLoading.current && !mapLoading && !hasQueuedSpectatorReady.current) {
      hasQueuedSpectatorReady.current = true;
      spectatorReadyTimeoutId.current = window.setTimeout(() => {
        spectatorReadyTimeoutId.current = null;
        setIsReady(true);
      }, 0);
      dismiss(POST_MAP_LOAD_DELAY_MS);
    }
  }, [mapLoading, isSpectating, dismiss]);

  useEffect(() => {
    return () => {
      if (spectatorReadyTimeoutId.current !== null) {
        window.clearTimeout(spectatorReadyTimeoutId.current);
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
  const hasNavigatedToTarget = isSpectating ? elapsedMs >= TICK_INTERVAL_MS : playerStructures.length > 0;
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
    if (phase === "ready") return ["Realm ready!"];
    if (phase === "slow") return ["Taking longer than usual, still syncing...", "Still assembling your realm..."];
    if (phase === "handoff") return ["Opening your realm portal..."];
    return ["Rendering your realm...", "Placing structures...", "Waking your armies..."];
  }, [phase]);

  const tasks = useMemo<BootstrapTask[]>(() => {
    if (phase === "ready") {
      return [
        { id: "handoff", label: "Transitioning to the realm", status: "complete" },
        { id: "render", label: "Rendering terrain and structures", status: "complete" },
        { id: "final", label: "Final checks", status: "complete" },
      ];
    }

    if (phase === "handoff") {
      return [
        { id: "handoff", label: "Transitioning to the realm", status: "running" },
        { id: "render", label: "Rendering terrain and structures", status: "pending" },
        { id: "final", label: "Final checks", status: "pending" },
      ];
    }

    if (phase === "slow") {
      return [
        { id: "handoff", label: "Transitioning to the realm", status: "complete" },
        { id: "render", label: "Rendering terrain and structures", status: "running" },
        { id: "final", label: "Final checks", status: "running" },
      ];
    }

    return [
      { id: "handoff", label: "Transitioning to the realm", status: "complete" },
      { id: "render", label: "Rendering terrain and structures", status: "running" },
      { id: "final", label: "Final checks", status: "pending" },
    ];
  }, [phase]);

  const overlayTitle = isSpectating ? "Entering World View" : "Entering Realm";

  return (
    <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-sm">
      <div className="bg-black/20 border-r border-[0.5px] border-gradient text-gold relative backdrop-filter backdrop-blur-[32px] panel-wood panel-wood-corners w-full max-w-[456px] p-4 sm:p-5">
        <div className="text-center mb-3">
          <div className="text-[10px] sm:text-xs uppercase tracking-widest text-gold/60">Step 2 of 2</div>
          <h3 className="text-base sm:text-lg font-semibold text-gold mt-1">{overlayTitle}</h3>
        </div>
        <BootstrapLoadingPanel tasks={tasks} progress={progress} error={null} onRetry={() => {}} statements={statements} />
      </div>
    </div>
  );
};
