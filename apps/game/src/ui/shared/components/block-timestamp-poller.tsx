import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useEffect } from "react";

export const BlockTimestampPoller = () => {
  const tick = useBlockTimestampStore((state) => state.tick);

  useEffect(() => {
    tick();
    return useChainTimeStore.subscribe(() => tick());
  }, [tick]);

  return null;
};
