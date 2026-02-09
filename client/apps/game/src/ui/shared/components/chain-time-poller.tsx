import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";

import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { CHAIN_TIME_DEBUG_STORAGE_KEY, logChainTimeDebug } from "@/utils/chain-time-debug";

const POLL_INTERVAL_MS = 60_000;

export const ChainTimePoller = () => {
  const {
    setup: {
      network: { provider },
    },
  } = useDojo();

  const setChainHeartbeat = useChainTimeStore((state) => state.setHeartbeat);

  useEffect(() => {
    setBlockTimestampSource(() => useChainTimeStore.getState().getNowSeconds());
    logChainTimeDebug("source_bound", {
      source: "useChainTimeStore.getNowSeconds",
      pollIntervalMs: POLL_INTERVAL_MS,
      debugStorageKey: CHAIN_TIME_DEBUG_STORAGE_KEY,
    });
  }, []);

  useEffect(() => {
    let intervalId: number | null = null;
    let isCancelled = false;

    const poll = async () => {
      const rpcProvider = (provider as any).provider ?? provider;
      if (!rpcProvider?.getBlock) {
        return;
      }

      try {
        const pollStartedAtMs = Date.now();
        const block = await rpcProvider.getBlock("latest");
        const timestampSeconds = Number((block as any).timestamp ?? (block as any).block_timestamp);
        if (!Number.isFinite(timestampSeconds)) {
          logChainTimeDebug("poll_invalid_timestamp", {
            rawTimestamp: (block as any).timestamp ?? (block as any).block_timestamp,
          });
          return;
        }

        const blockNumber =
          typeof (block as any).block_number === "number"
            ? (block as any).block_number
            : typeof (block as any).blockNumber === "number"
              ? (block as any).blockNumber
              : undefined;

        if (isCancelled) {
          return;
        }

        const heartbeatTimestampMs = timestampSeconds * 1000;
        const localNowMs = Date.now();
        const chainToLocalDeltaMs = localNowMs - heartbeatTimestampMs;

        logChainTimeDebug("poll_success", {
          blockNumber: blockNumber ?? null,
          chainTimestampSeconds: timestampSeconds,
          heartbeatTimestampMs,
          localNowMs,
          chainToLocalDeltaMs,
          pollLatencyMs: localNowMs - pollStartedAtMs,
        });

        setChainHeartbeat({
          timestamp: heartbeatTimestampMs,
          blockNumber,
          source: "rpc.getBlock(latest)",
        });
      } catch (error) {
        console.warn("[chain-time] failed to fetch latest block timestamp", error);
        logChainTimeDebug("poll_error", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void poll();
    intervalId = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [provider, setChainHeartbeat]);

  return null;
};
