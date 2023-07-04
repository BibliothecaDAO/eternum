import { create } from 'zustand';
import { useEffect } from 'react';

interface BlockchainState {
  nextBlockTimestamp: number | undefined;
  setNextBlockTimestamp: (nextBlockTimestamp: number) => void;
}

const useBlockchainStore = create<BlockchainState>((set) => ({
  nextBlockTimestamp: undefined,
  setNextBlockTimestamp: (nextBlockTimestamp: number) =>
    set({ nextBlockTimestamp }),
}));

export const useFetchBlockchainData = () => {
  const { setNextBlockTimestamp } = useBlockchainStore();

  useEffect(() => {
    const fetchBlockchainTimestamp = async () => {
      // Perform the necessary logic to fetch the blockchain timestamp
      const timestamp = await fetchBlockTimestamp(); // Example: getBlockchainTimestamp is a placeholder for your blockchain timestamp retrieval logic

      // Update the state with the fetched timestamp
      if (timestamp) {
        setNextBlockTimestamp(timestamp);
      }
    };

    fetchBlockchainTimestamp(); // Initial fetch

    const intervalId = setInterval(fetchBlockchainTimestamp, 5000); // Fetch every 5 seconds

    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
    };
  }, []);
};

const fetchBlockTimestamp = async (): Promise<number | undefined> => {
    try {
      // TODO: create config file for endpoints
      const response = await fetch('http://127.0.0.1:5050/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'katana_nextBlockTimestamp',
          params: {},
          id: 1,
        }),
      });
  
      const data = await response.json();
  
      return data.result;
    } catch (error) {
      console.error('Error fetching block timestamp:', error);
      return undefined;
    }
};

export default useBlockchainStore;
