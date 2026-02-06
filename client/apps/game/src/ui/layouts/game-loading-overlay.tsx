import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePlayerStructures } from "@bibliothecadao/react";
import { useEffect, useRef } from "react";

const SAFETY_TIMEOUT_MS = 15_000;
// Minimum time the overlay stays visible after structures are detected,
// giving the hex scene time to render buildings from RECS data.
const MIN_DISPLAY_MS = 3_000;

const log = (...args: unknown[]) => console.log("[BLITZ-ENTRY]", ...args);

/**
 * Simple loading overlay that replaces BlitzOnboarding.
 * Shows while player structure data syncs into RECS after <World> mounts.
 * Auto-dismisses once player structures are detected (+ min delay) or after a safety timeout.
 */
export const GameLoadingOverlay = () => {
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const playerStructures = usePlayerStructures();
  const hasDismissed = useRef(false);
  const mountTime = useRef(0);

  // Capture mount time in an effect to satisfy React purity rules
  useEffect(() => {
    mountTime.current = Date.now();
    log("MOUNTED at", new Date().toISOString());
    return () => log("UNMOUNTED");
  }, []);

  // Log structure changes
  useEffect(() => {
    log(
      "playerStructures changed:",
      playerStructures.length,
      "structures",
      playerStructures.map((s) => s.entityId),
    );
  }, [playerStructures]);

  // Auto-dismiss when player structures are loaded into RECS (with min delay)
  useEffect(() => {
    if (hasDismissed.current) return;
    if (playerStructures.length > 0) {
      hasDismissed.current = true;
      const elapsed = Date.now() - mountTime.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
      log("Structures detected! elapsed:", elapsed, "ms, waiting additional:", remaining, "ms before dismiss");
      setTimeout(() => {
        log("DISMISSING overlay now");
        setShowBlankOverlay(false);
      }, remaining);
    }
  }, [playerStructures, setShowBlankOverlay]);

  // Safety timeout: dismiss even if structures never load (e.g. spectator, error)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasDismissed.current) {
        log("SAFETY TIMEOUT reached -", SAFETY_TIMEOUT_MS, "ms elapsed, dismissing without structures");
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
