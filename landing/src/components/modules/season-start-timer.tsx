import { configManager } from "@/dojo/setup";
import { useEffect, useState } from "react";

export const SeasonStartTimer = () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const seasonStart = configManager.getSeasonConfig().startAt || 0n;

  const [countdown, setCountdown] = useState(() => {
    return BigInt(seasonStart) - BigInt(timestamp);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1n);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (countdown < 0 || timestamp === 0 || seasonStart === 0n) return null;

  const hours = Math.floor(Number(countdown) / 3600);
  const minutes = Math.floor((Number(countdown) % 3600) / 60);
  const seconds = Number(countdown) % 60;

  return (
    <div className="text-3xl text-primary font-semibold">
      {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </div>
  );
};
