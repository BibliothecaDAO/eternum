import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";

import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";

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
        const block = await rpcProvider.getBlock("latest");
        const timestampSeconds = Number((block as any).timestamp ?? (block as any).block_timestamp);
        if (!Number.isFinite(timestampSeconds)) {
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

        setChainHeartbeat({
          source: "mock",
          timestamp: timestampSeconds * 1000,
          blockNumber,
        });
      } catch (error) {
        console.warn("[chain-time] failed to fetch latest block timestamp", error);
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
