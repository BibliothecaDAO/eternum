import { configManager, TickIds } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEffect, useState } from "react";

export const useBlockTimestamp = () => {
  const [currentDefaultTick, setCurrentDefaultTick] = useState(0);
  const dojo = useDojo();

  useEffect(() => {
    const updateTick = () => {
      const currentTick = Math.floor(Date.now() / 1000);
      setCurrentDefaultTick(currentTick);
    };

    updateTick();
    const interval = setInterval(updateTick, 10000);

    return () => clearInterval(interval);
  }, []);

  return {
    currentDefaultTick,
  };
};

export const getBlockTimestamp = () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const tickConfigArmies = configManager.getTick(TickIds.Armies);
  const tickConfigDefault = configManager.getTick(TickIds.Default);

  const currentDefaultTick = Math.floor(timestamp / Number(tickConfigDefault));
  const currentArmiesTick = Math.floor(timestamp / Number(tickConfigArmies));

  return {
    currentBlockTimestamp: timestamp,
    currentDefaultTick,
    currentArmiesTick,
  };
};
