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
  try {
    // NOTE: if we are using Katana in dev, we should use next block timestmamp because of
    // the advance_time functionality
    // TODO: make sure this is still the case
    if (import.meta.env.VITE_DEV === "true") {
      const response = await fetch(import.meta.env.VITE_KATANA_URL!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "katana_nextBlockTimestamp",
          params: {},
          id: 1,
        }),
      });
      const data = await response.json();
      return data.result;
    } else {
      // NOTE: if we are using Katana in dev, we should use next block timestmamp because
      // it allows us to advance time. But current issue with next_block_timestamp is that
      // it does not get updated in katana until someone mints a new block. Since in prod we should
      // not be able to use advance time, we should use current block timestamp
      return Date.now() / 1000;
    }
  } catch (error) {
    console.error("Error fetching block timestamp:", error);
    return undefined;
  }
};

export default useBlockchainStore;
