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

  const tickConfigArmies = configManager.getTick(TickIds.Armies);
  const tickConfigDefault = configManager.getTick(TickIds.Default);

  useEffect(() => {
    const fetchBlockchainTimestamp = async () => {
      // Perform the necessary logic to fetch the blockchain timestamp
      const timestamp = await fetchBlockTimestamp(); // Example: getBlockchainTimestamp is a placeholder for your blockchain timestamp retrieval logic

      // Update the state with the fetched timestamp
      if (timestamp) {
        // Check if fetched timestamp is different from current state
        setNextBlockTimestamp(timestamp);
        setCurrentDefaultTick(Math.floor(timestamp / Number(tickConfigDefault)));
        setCurrentArmiesTick(Math.floor(timestamp / Number(tickConfigArmies)));
      }
    };

    fetchBlockchainTimestamp(); // Initial fetch

    const intervalId = setInterval(fetchBlockchainTimestamp, 10000); // Fetch every 10 seconds

    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
    };
  }, []);
};

const fetchBlockTimestamp = async (): Promise<number | undefined> => {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return currentTimestamp;
};
