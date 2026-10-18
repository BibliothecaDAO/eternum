import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useState } from "react";

/**
 * Whether an action that loses something for good (disbanding an army, dismissing a guard) asks first: only in Frontier.
 * In Blitz and Eternum time is of the essence, so it acts at once (the owner's ruling, 18 October 2026).
 */
export const useConfirmsLoss = (): boolean => useGameModeConfig().id === "frontier";

/**
 * The confirm step of an action on one target (a site, an army, a guard slot): open only for the target it was asked
 * for, and closed once the target changes, so a panel kept on screen for the next target never confirms that one.
 */
export const useConfirmFor = (target: string | number) => {
  const [askedFor, setAskedFor] = useState<string | number | null>(null);
  if (askedFor !== null && askedFor !== target) setAskedFor(null);
  return {
    confirming: askedFor === target,
    ask: () => setAskedFor(target),
    close: () => setAskedFor(null),
  };
};
