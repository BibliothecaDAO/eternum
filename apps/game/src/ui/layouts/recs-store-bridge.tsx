import { installRecsStoreBridge } from "@/sync/recs-store-bridge";
import { requireActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";

/** Mounts the one RECS → store bridge for the lifetime of the world layout. */
export const RecsStoreBridge = () => {
  const {
    setup: { components },
  } = useDojo();

  useEffect(() => installRecsStoreBridge({ components, runtime: requireActiveGameSyncRuntime() }), [components]);

  return null;
};
