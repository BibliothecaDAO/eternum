import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { Position } from "@bibliothecadao/eternum";
import { usePlayerStructures } from "@bibliothecadao/react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const SAFETY_TIMEOUT_MS = 15_000;
// Time to wait after navigating to hex before dismissing (player path)
const POST_NAVIGATE_DELAY_MS = 1_500;
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
  const navigate = useNavigate();

  const dismiss = (delayMs: number) => {
    if (hasDismissed.current) return;
    hasDismissed.current = true;
    setTimeout(() => setShowBlankOverlay(false), delayMs);
  };

  // --- Player path: navigate to first structure once it appears in RECS ---
  useEffect(() => {
    if (hasDismissed.current || isSpectating) return;
    if (playerStructures.length === 0) return;

    const first = playerStructures[0];
    const normalized = new Position({ x: first.position.x, y: first.position.y }).getNormalized();

    const setStructureEntityId = useUIStore.getState().setStructureEntityId;
    setStructureEntityId(first.entityId, {
      spectator: false,
      worldMapPosition: { col: normalized.x, row: normalized.y },
    });

    const url = `/play/hex?col=${normalized.x}&row=${normalized.y}`;
    navigate(url);
    window.dispatchEvent(new Event("urlChanged"));

    dismiss(POST_NAVIGATE_DELAY_MS);
  }, [playerStructures, isSpectating, setShowBlankOverlay, navigate]);

  // --- Spectator path: dismiss once the world map finishes its initial fetch ---
  useEffect(() => {
    if (hasDismissed.current || !isSpectating) return;

    if (mapLoading) {
      hasSeenMapLoading.current = true;
    }

    // Map loading went true → false: initial tile fetch complete.
    // Wait additional time for the bounds subscription to stream
    // Structure entities and for the map to render them.
    if (hasSeenMapLoading.current && !mapLoading) {
      dismiss(POST_MAP_LOAD_DELAY_MS);
    }
  }, [mapLoading, isSpectating, setShowBlankOverlay]);

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

  return (
    <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-6">
        <img
          src="/images/logos/eternum-loader.png"
          className="w-32 sm:w-24 lg:w-24 xl:w-28 animate-pulse"
          alt="Loading"
        />
        <p className="font-cinzel text-xl text-gold tracking-wider animate-pulse">
          {isSpectating ? "Loading world..." : "Entering game..."}
        </p>
      </div>
    </div>
  );
};
