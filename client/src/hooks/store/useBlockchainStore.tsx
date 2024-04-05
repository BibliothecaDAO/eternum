import { create } from "zustand";
import { useEffect } from "react";

export const TIME_PER_TICK = 60;

interface BlockchainState {
  nextBlockTimestamp: number | undefined;
  setNextBlockTimestamp: (nextBlockTimestamp: number) => void;
  currentTick: number;
  setCurrentTick: (currentTick: number) => void;
}

const useBlockchainStore = create<BlockchainState>((set) => ({
  nextBlockTimestamp: undefined,
  setNextBlockTimestamp: (nextBlockTimestamp: number) => set({ nextBlockTimestamp }),
  currentTick: 0,
  setCurrentTick: (currentTick: number) => set({ currentTick }),
}));

export const useFetchBlockchainData = () => {
  const setNextBlockTimestamp = useBlockchainStore((state) => state.setNextBlockTimestamp);
  const setCurrentTick = useBlockchainStore((state) => state.setCurrentTick);
  const currentTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp); // Get the current nextBlockTimestamp from the store

  useEffect(() => {
    const fetchBlockchainTimestamp = async () => {
      // Perform the necessary logic to fetch the blockchain timestamp
      const timestamp = await fetchBlockTimestamp(); // Example: getBlockchainTimestamp is a placeholder for your blockchain timestamp retrieval logic

      // Update the state with the fetched timestamp
      if (timestamp && timestamp !== currentTimestamp) {
        // Check if fetched timestamp is different from current state
        setNextBlockTimestamp(timestamp);
        setCurrentTick(Math.floor(timestamp / TIME_PER_TICK));
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
  return Math.floor(Date.now() / 1000);
};

export default useBlockchainStore;
