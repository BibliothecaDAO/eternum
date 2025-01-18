import { configManager, TickIds } from "@bibliothecadao/eternum";
import { useEffect, useTransition } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";

export const useFetchBlockchainData = () => {
  const [_isPending, startTransition] = useTransition();

  useEffect(() => {
    const tickConfigArmies = configManager.getTick(TickIds.Armies);
    const tickConfigDefault = configManager.getTick(TickIds.Default);

    const fetchBlockchainTimestamp = async () => {
      const timestamp = Math.floor(Date.now() / 1000);

      if (timestamp) {
        startTransition(() => {
          useUIStore.setState({
            nextBlockTimestamp: timestamp,
            currentDefaultTick: Math.floor(timestamp / Number(tickConfigDefault)),
            currentArmiesTick: Math.floor(timestamp / Number(tickConfigArmies)),
          });
        });
      }
    };

    fetchBlockchainTimestamp(); // Initial fetch

    const intervalId = setInterval(fetchBlockchainTimestamp, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);
};
