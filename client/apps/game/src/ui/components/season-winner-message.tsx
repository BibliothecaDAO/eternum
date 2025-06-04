import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEffect, useMemo, useState } from "react";

const formatTimeRemaining = (seconds: number): string => {
  if (seconds <= 0) return "Bridge closed";

  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

export const SeasonWinnerMessage = () => {
  const {
    setup: { components },
  } = useDojo();

  const bridgeEndTimestamp = useMemo(() => {
    const seasonConfig = configManager.getSeasonConfig();
    return seasonConfig.endAt + seasonConfig.bridgeCloseAfterEndSeconds;
  }, [components]);

  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = bridgeEndTimestamp - now;
      setTimeRemaining(remaining);
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [bridgeEndTimestamp]);

  const seasonWinner = useUIStore((state) => state.seasonWinner);

  if (!seasonWinner) return null;

  return (
    <>
      <div className="fixed left-1/2 transform -translate-x-1/2 z-50 w-[400px] md:w-[800px] top-[60px]">
        <div className="my-4 py-4 px-6 border-4 border-gold-600/70 rounded-xl bg-slate-900/70 shadow-xl shadow-gold-500/20 text-center">
          <div className="font-serif text-2xl md:text-3xl text-amber-400 animate-pulse tracking-wider leading-relaxed uppercase">
            the season is over.
            <br />
            {seasonWinner.name} and the {seasonWinner.guildName} tribe have conquered eternum
          </div>
          <div className="mt-4 pt-4 border-t border-gold-600/30">
            <div className="text-lg md:text-xl text-amber-300 font-semibold">Time remaining to bridge out:</div>
            <div className="text-xl md:text-2xl text-red-400 font-bold mt-2">{formatTimeRemaining(timeRemaining)}</div>
          </div>
        </div>
      </div>
    </>
  );
};
