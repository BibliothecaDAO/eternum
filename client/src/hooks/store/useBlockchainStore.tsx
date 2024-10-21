import { TickIds, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect } from "react";
import { useDojo } from "../context/DojoContext";
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
  const {
    setup: {
      components: { TickConfig },
    },
  } = useDojo();

  const setNextBlockTimestamp = useUIStore((state) => state.setNextBlockTimestamp);
  const setCurrentDefaultTick = useUIStore((state) => state.setCurrentDefaultTick);
  const setCurrentArmiesTick = useUIStore((state) => state.setCurrentArmiesTick);

  useEffect(() => {
    const tickConfigArmies = getComponentValue(
      TickConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(TickIds.Armies)]),
    );
    const tickConfigDefault = getComponentValue(
      TickConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(TickIds.Default)]),
    );

    console.log(tickConfigArmies, tickConfigDefault);

    const fetchBlockchainTimestamp = async () => {
      const timestamp = Math.floor(Date.now() / 1000);

      if (timestamp) {
        setNextBlockTimestamp(timestamp);
        setCurrentDefaultTick(Math.floor(timestamp / Number(tickConfigDefault!.tick_interval_in_seconds)));
        setCurrentArmiesTick(Math.floor(timestamp / Number(tickConfigArmies!.tick_interval_in_seconds)));
      }
    };

    fetchBlockchainTimestamp(); // Initial fetch

    return () => {
      clearInterval(setInterval(fetchBlockchainTimestamp, 10000));
    };
  }, []);
};
