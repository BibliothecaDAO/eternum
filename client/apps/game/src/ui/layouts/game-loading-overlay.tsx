import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@bibliothecadao/eternum";
import { usePlayerStructures } from "@bibliothecadao/react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const SAFETY_TIMEOUT_MS = 15_000;
// Time to wait after navigating to the correct position before dismissing,
// giving the hex scene time to render buildings from RECS data.
const POST_NAVIGATE_DELAY_MS = 1_500;

/**
 * Loading overlay shown while player structure data syncs into RECS after <World> mounts.
 *
 * Once structures are detected in RECS:
 * 1. Navigates to the player's first structure (normalized coords)
 * 2. Sets structureEntityId in the UI store
 * 3. Waits briefly for the scene to re-render, then dismisses
 *
 * Falls back to a safety timeout for spectators or if sync fails.
 */
export const GameLoadingOverlay = () => {
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const playerStructures = usePlayerStructures();
  const hasDismissed = useRef(false);
  const navigate = useNavigate();

  // Navigate to first structure and dismiss once structures are in RECS
  useEffect(() => {
    if (hasDismissed.current) return;
    if (playerStructures.length === 0) return;

    hasDismissed.current = true;

    const first = playerStructures[0];
    // position.x / position.y are contract coords — normalize to game coords
    const normalized = new Position({ x: first.position.x, y: first.position.y }).getNormalized();

    // Update the UI store with the actual structure
    const setStructureEntityId = useUIStore.getState().setStructureEntityId;
    setStructureEntityId(first.entityId, {
      spectator: false,
      worldMapPosition: { col: normalized.x, row: normalized.y },
    });

    // Navigate to the correct position
    const url = `/play/hex?col=${normalized.x}&row=${normalized.y}`;
    navigate(url);
    window.dispatchEvent(new Event("urlChanged"));

    // Wait for the scene to re-setup with correct coords and render buildings
    setTimeout(() => {
      setShowBlankOverlay(false);
    }, POST_NAVIGATE_DELAY_MS);
  }, [playerStructures, setShowBlankOverlay, navigate]);

  // Safety timeout: dismiss even if structures never load (e.g. spectator, error)
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
        <p className="font-cinzel text-xl text-gold tracking-wider animate-pulse">Entering game...</p>
      </div>
    </div>
  );
};
