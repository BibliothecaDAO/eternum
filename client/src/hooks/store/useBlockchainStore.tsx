import { configManager } from "@/dojo/setup";
import { TickIds } from "@bibliothecadao/eternum";
import { useEffect } from "react";
import useUIStore from "./useUIStore";

export interface BlockchainStore {
  nextBlockTimestamp: number | undefined;
  setNextBlockTimestamp: (nextBlockTimestamp: number) => void;
  currentArmiesTick: number;
  setCurrentArmiesTick: (currentDefaultTick: number) => void;
  currentDefaultTick: number;
  setCurrentDefaultTick: (currentDefaultTick: number) => void;
}

export const createBlockchainStore = (set: any) => ({
  nextBlockTimestamp: undefined,
  setNextBlockTimestamp: (nextBlockTimestamp: number) => set({ nextBlockTimestamp }),
  currentDefaultTick: 0,
  setCurrentDefaultTick: (currentDefaultTick: number) => set({ currentDefaultTick }),
  currentArmiesTick: 0,
  setCurrentArmiesTick: (currentArmiesTick: number) => set({ currentArmiesTick }),
});

export const useFetchBlockchainData = () => {
  const setNextBlockTimestamp = useUIStore((state) => state.setNextBlockTimestamp);
  const setCurrentDefaultTick = useUIStore((state) => state.setCurrentDefaultTick);
  const setCurrentArmiesTick = useUIStore((state) => state.setCurrentArmiesTick);

  useEffect(() => {
    const tickConfigArmies = configManager.getTick(TickIds.Armies);
    const tickConfigDefault = configManager.getTick(TickIds.Default);

    const fetchBlockchainTimestamp = async () => {
      const timestamp = Math.floor(Date.now() / 1000);

      if (timestamp) {
        setNextBlockTimestamp(timestamp);
        setCurrentDefaultTick(Math.floor(timestamp / Number(tickConfigDefault)));
        setCurrentArmiesTick(Math.floor(timestamp / Number(tickConfigArmies)));
      }
    };

    fetchBlockchainTimestamp(); // Initial fetch

    const intervalId = setInterval(fetchBlockchainTimestamp, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);
};
