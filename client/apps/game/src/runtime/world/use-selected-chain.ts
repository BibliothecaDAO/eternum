import { useEffect, useState } from "react";
import type { Chain } from "@contracts";

import { resolveChain, resolveRuntimeChain, subscribeActiveWorldName, subscribeSelectedChain } from "./store";

export const useSelectedRuntimeChain = (fallbackChain: Chain): Chain => {
  const [selectedChain, setSelectedChain] = useState<Chain>(() => resolveChain(fallbackChain));

  useEffect(() => {
    return subscribeSelectedChain((nextChain) => {
      setSelectedChain(nextChain ?? fallbackChain);
    });
  }, [fallbackChain]);

  return selectedChain;
};

export const useRuntimeChain = (fallbackChain: Chain): Chain => {
  const [runtimeChain, setRuntimeChain] = useState<Chain>(() => resolveRuntimeChain(fallbackChain));

  useEffect(() => {
    const updateRuntimeChain = () => {
      setRuntimeChain(resolveRuntimeChain(fallbackChain));
    };

    const unsubscribeSelectedChain = subscribeSelectedChain(updateRuntimeChain);
    const unsubscribeActiveWorld = subscribeActiveWorldName(updateRuntimeChain);

    return () => {
      unsubscribeSelectedChain();
      unsubscribeActiveWorld();
    };
  }, [fallbackChain]);

  return runtimeChain;
};
