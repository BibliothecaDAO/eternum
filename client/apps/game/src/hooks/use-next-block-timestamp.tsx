import { configManager } from "@/dojo/setup";
import { TickIds } from "@bibliothecadao/eternum";
import { startTransition, useEffect, useState } from "react";

const useNextBlockTimestamp = () => {
  const [nextBlockTimestamp, setNextBlockTimestamp] = useState<number>(Math.floor(Date.now() / 1000));
  const [currentDefaultTick, setCurrentDefaultTick] = useState<number>(0);
  const [currentArmiesTick, setCurrentArmiesTick] = useState<number>(0);

  useEffect(() => {
    const tickConfigArmies = configManager.getTick(TickIds.Armies);
    const tickConfigDefault = configManager.getTick(TickIds.Default);

    const updateTimestamp = () => {
      const timestamp = Math.floor(Date.now() / 1000);

      const newDefaultTick = Math.floor(timestamp / Number(tickConfigDefault));
      const newArmiesTick = Math.floor(timestamp / Number(tickConfigArmies));

      startTransition(() => {
        setNextBlockTimestamp(timestamp);
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

  return { nextBlockTimestamp, currentDefaultTick, currentArmiesTick };
};

export default useNextBlockTimestamp;
