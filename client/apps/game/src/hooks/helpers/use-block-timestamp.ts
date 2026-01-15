import { getBlockTimestamp } from "@bibliothecadao/eternum";

import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { startTransition, useEffect, useState } from "react";

export const useBlockTimestamp = () => {
  const [currentBlockTimestamp, setCurrentBlockTimestamp] = useState<number>(Math.floor(Date.now() / 1000));
  const [currentDefaultTick, setCurrentDefaultTick] = useState<number>(0);
  const [currentArmiesTick, setCurrentArmiesTick] = useState<number>(0);
  const [armiesTickTimeRemaining, setArmiesTickTimeRemaining] = useState<number>(0);

  useEffect(() => {
    const updateTimestamp = () => {
      const {
        currentBlockTimestamp: timestamp,
        currentDefaultTick: newDefaultTick,
        currentArmiesTick: newArmiesTick,
      } = getBlockTimestamp();

      // Calculate time remaining in current armies tick
      const tickConfigArmies = configManager.getTick(TickIds.Armies);
      const armiesTickDuration = Number(tickConfigArmies);
      const timePassedInCurrentTick = timestamp % armiesTickDuration;
      const timeRemaining = armiesTickDuration - timePassedInCurrentTick;

      startTransition(() => {
        setCurrentBlockTimestamp(timestamp);
        setCurrentDefaultTick(newDefaultTick);
        setCurrentArmiesTick(newArmiesTick);
        setArmiesTickTimeRemaining(timeRemaining);
      });
    };

    updateTimestamp();

    const intervalId = setInterval(updateTimestamp, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return { currentBlockTimestamp, currentDefaultTick, currentArmiesTick, armiesTickTimeRemaining };
};
