import { configManager } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";

export const useSeasonStart = () => {
  const seasonStart = useMemo(() => BigInt(configManager.getSeasonConfig().startSettlingAt || 0), []);
  const currentBlockTimestamp = useMemo(() => BigInt(Math.floor(Date.now() / 1000)), []);

  const [countdown, setCountdown] = useState<bigint>(0n);
  useMemo(() => {
    if (currentBlockTimestamp === 0n || seasonStart === 0n) return;

    const initialCountdown = seasonStart - currentBlockTimestamp;
    setCountdown(initialCountdown);

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1n);
    }, 1000);

    return () => clearInterval(timer);
  }, [currentBlockTimestamp, seasonStart]);

  return { seasonStart, countdown, currentBlockTimestamp };
};
