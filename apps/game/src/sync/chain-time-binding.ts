import { setBlockTimestampSource, setChainProvenTimestampSource } from "@bibliothecadao/eternum";

import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { CHAIN_TIME_DEBUG_STORAGE_KEY, logChainTimeDebug } from "@/utils/chain-time-debug";

/**
 * Binds the client's chain time to the chain-time store, before any game client starts: Herald's hello anchors the
 * store with a confirmed head, and until one arrives there is no chain time to read.
 */
export const bindChainTime = (): void => {
  setBlockTimestampSource(() => useChainTimeStore.getState().getNowSeconds());
  // Balances, stamina and spend limits use the execution floor: confirmed heads, never a pre-confirmed one.
  setChainProvenTimestampSource(() => {
    const floorMs = useChainTimeStore.getState().executionFloorMs;
    return floorMs === null ? null : Math.floor(floorMs / 1000);
  });
  logChainTimeDebug("source_bound", {
    source: "herald heads",
    debugStorageKey: CHAIN_TIME_DEBUG_STORAGE_KEY,
  });
};
