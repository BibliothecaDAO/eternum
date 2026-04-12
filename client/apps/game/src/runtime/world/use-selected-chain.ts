import { useEffect, useState } from "react";
import type { Chain } from "@contracts";

import { resolveChain, subscribeSelectedChain } from "./store";

export const useSelectedRuntimeChain = (fallbackChain: Chain): Chain => {
  const [selectedChain, setSelectedChain] = useState<Chain>(() => resolveChain(fallbackChain));

  useEffect(() => {
    return subscribeSelectedChain((nextChain) => {
      setSelectedChain(nextChain ?? fallbackChain);
    });
  }, [fallbackChain]);

  return selectedChain;
};
