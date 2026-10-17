import { useState } from "react";

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
