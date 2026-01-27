import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useEffect } from "react";

const POLL_INTERVAL_MS = 10_000;

export const BlockTimestampPoller = () => {
  const tick = useBlockTimestampStore((state) => state.tick);

  useEffect(() => {
    tick();
    const intervalId = window.setInterval(() => {
      tick();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [tick]);

  return null;
};
