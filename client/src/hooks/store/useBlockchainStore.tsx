import { TickIds, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect } from "react";
import { create } from "zustand";
import { useDojo } from "../context/DojoContext";

interface BlockchainState {
  nextBlockTimestamp: number | undefined;
  setNextBlockTimestamp: (nextBlockTimestamp: number) => void;
  currentArmiesTick: number;
  setCurrentArmiesTick: (currentDefaultTick: number) => void;
  currentDefaultTick: number;
  setCurrentDefaultTick: (currentDefaultTick: number) => void;
}

const useBlockchainStore = create<BlockchainState>((set) => ({
  nextBlockTimestamp: undefined,
  setNextBlockTimestamp: (nextBlockTimestamp: number) => set({ nextBlockTimestamp }),
  currentDefaultTick: 0,
  setCurrentDefaultTick: (currentDefaultTick: number) => set({ currentDefaultTick }),
  currentArmiesTick: 0,
  setCurrentArmiesTick: (currentArmiesTick: number) => set({ currentArmiesTick }),
}));

export const useFetchBlockchainData = () => {
  const {
    setup: {
      components: { TickConfig },
    },
  } = useDojo();

  const setNextBlockTimestamp = useBlockchainStore((state) => state.setNextBlockTimestamp);
  const setCurrentDefaultTick = useBlockchainStore((state) => state.setCurrentDefaultTick);
  const setCurrentArmiesTick = useBlockchainStore((state) => state.setCurrentArmiesTick);
  const currentTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp); // Get the current nextBlockTimestamp from the store

  const tickConfigArmies = getComponentValue(
    TickConfig,
    getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(TickIds.Armies)]),
  );
  const tickConfigDefault = getComponentValue(
    TickConfig,
    getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(TickIds.Default)]),
  );

  useEffect(() => {
    const fetchBlockchainTimestamp = async () => {
      // Perform the necessary logic to fetch the blockchain timestamp
      const timestamp = await fetchBlockTimestamp(); // Example: getBlockchainTimestamp is a placeholder for your blockchain timestamp retrieval logic

      // Update the state with the fetched timestamp
      if (timestamp && timestamp !== currentTimestamp) {
        // Check if fetched timestamp is different from current state
        setNextBlockTimestamp(timestamp);
        setCurrentDefaultTick(Math.floor(timestamp / tickConfigDefault!.tick_interval_in_seconds));
        setCurrentArmiesTick(Math.floor(timestamp / tickConfigArmies!.tick_interval_in_seconds));
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

export default useBlockchainStore;
