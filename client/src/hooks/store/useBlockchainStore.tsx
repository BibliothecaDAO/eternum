import { create } from "zustand";
import { useEffect } from "react";

interface BlockchainState {
  nextBlockTimestamp: number | undefined;
  setNextBlockTimestamp: (nextBlockTimestamp: number) => void;
}

const useBlockchainStore = create<BlockchainState>((set) => ({
  nextBlockTimestamp: undefined,
  setNextBlockTimestamp: (nextBlockTimestamp: number) => set({ nextBlockTimestamp }),
}));

export const useFetchBlockchainData = () => {
  const setNextBlockTimestamp = useBlockchainStore((state) => state.setNextBlockTimestamp);
  const currentTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp); // Get the current nextBlockTimestamp from the store

  useEffect(() => {
    const fetchBlockchainTimestamp = async () => {
      // Perform the necessary logic to fetch the blockchain timestamp
      const timestamp = await fetchBlockTimestamp(); // Example: getBlockchainTimestamp is a placeholder for your blockchain timestamp retrieval logic

      // Update the state with the fetched timestamp
      if (timestamp && timestamp !== currentTimestamp) {
        // Check if fetched timestamp is different from current state
        setNextBlockTimestamp(timestamp);
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
  // NOTE: if we are using Katana in dev, we should use next block timestmamp because of
  // the advance_time functionality
  // TODO: make sure this is still the case
  return Date.now() / 1000;
};

export default useBlockchainStore;
