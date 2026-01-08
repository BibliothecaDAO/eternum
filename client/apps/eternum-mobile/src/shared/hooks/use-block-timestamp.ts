import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { useEffect, useState } from "react";

export const useBlockTimestamp = () => {
  const [currentBlockTimestamp, setCurrentBlockTimestamp] = useState<number>(Math.floor(Date.now() / 1000));
  const [currentDefaultTick, setCurrentDefaultTick] = useState<number>(0);
  const [currentArmiesTick, setCurrentArmiesTick] = useState<number>(0);

  useEffect(() => {
    const updateTick = () => {
      const {
        currentBlockTimestamp: timestamp,
        currentDefaultTick: newDefaultTick,
        currentArmiesTick: newArmiesTick,
      } = getBlockTimestamp();

      setCurrentBlockTimestamp(timestamp);
      setCurrentDefaultTick(newDefaultTick);
      setCurrentArmiesTick(newArmiesTick);
    };

    updateTick();
    const interval = setInterval(updateTick, 10000);

    return () => clearInterval(interval);
  }, []);

  return {
    currentBlockTimestamp,
    currentDefaultTick,
    currentArmiesTick,
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
