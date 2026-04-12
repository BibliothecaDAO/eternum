import type { ResolvedEntryContext } from "@/game-entry/context";

import type { BootstrappedEntrySession } from "./bootstrap";

export const resolveCachedEntrySessionForContext = (
  cachedSession: BootstrappedEntrySession,
  context: ResolvedEntryContext,
): BootstrappedEntrySession => {
  return {
    ...cachedSession,
    context,
  };
};
