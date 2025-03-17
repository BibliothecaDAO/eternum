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
