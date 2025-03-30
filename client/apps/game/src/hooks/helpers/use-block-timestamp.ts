import { getBlockTimestamp } from "@/utils/timestamp";
import { startTransition, useEffect, useState } from "react";

export const useBlockTimestamp = () => {
  const [currentBlockTimestamp, setCurrentBlockTimestamp] = useState<number>(Math.floor(Date.now() / 1000));
  const [currentDefaultTick, setCurrentDefaultTick] = useState<number>(0);
  const [currentArmiesTick, setCurrentArmiesTick] = useState<number>(0);

  useEffect(() => {
    const updateTimestamp = () => {
      const {
        currentBlockTimestamp: timestamp,
        currentDefaultTick: newDefaultTick,
        currentArmiesTick: newArmiesTick,
      } = getBlockTimestamp();

      startTransition(() => {
        setCurrentBlockTimestamp(timestamp);
        setCurrentDefaultTick(newDefaultTick);
        setCurrentArmiesTick(newArmiesTick);
      });
    };

    updateTimestamp();

    const intervalId = setInterval(updateTimestamp, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return { currentBlockTimestamp, currentDefaultTick, currentArmiesTick };
};
