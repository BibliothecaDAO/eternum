import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useEffect } from "react";

export const BlockTimestampPoller = () => {
  const tick = useBlockTimestampStore((state) => state.tick);

  useEffect(() => {
    tick();
  }, [tick]);

  return null;
};
