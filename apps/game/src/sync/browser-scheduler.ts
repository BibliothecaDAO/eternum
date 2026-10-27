import type { GameSyncScheduler } from "@bibliothecadao/eternum/game-sync";

import { runWithFrameWorkOwner } from "@/three/frame-work-owner";
import { requestFrameOrTimeout } from "@/utils/frame-or-timeout";

/** Drains sync batches on the render frame, attributed to the frame-work owner; a timer keeps a hidden tab draining. */
export const createBrowserScheduler = (): GameSyncScheduler => ({
  schedule(task) {
    return requestFrameOrTimeout(() => runWithFrameWorkOwner("sync:ingest", task));
  },
});
