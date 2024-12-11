import { configManager } from "@/dojo/setup";
import { useMemo, useState } from "react";

export const useSeasonStart = () => {
  const seasonStart = useMemo(() => BigInt(configManager.getSeasonConfig().startAt || 0), []);
  const nextBlockTimestamp = useMemo(() => BigInt(Math.floor(Date.now() / 1000)), []);

  const [countdown, setCountdown] = useState<bigint>(0n);
  useMemo(() => {
    if (nextBlockTimestamp === 0n || seasonStart === 0n) return;

    const initialCountdown = seasonStart - nextBlockTimestamp;
    setCountdown(initialCountdown);

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1n);
    }, 1000);

    return () => clearInterval(timer);
  }, [nextBlockTimestamp, seasonStart]);

  return { seasonStart, countdown, nextBlockTimestamp };
};
