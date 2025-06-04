import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { X } from "lucide-react";
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
  const [isVisible, setIsVisible] = useState(true);

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

  if (!seasonWinner || !isVisible) return null;

  return (
    <>
      <div className="fixed left-1/2 transform -translate-x-1/2 z-50 w-[360px] md:w-[500px] top-[20px] md:top-[40px]">
        <div className="relative my-2 py-3 px-4 border border-gold-500/50 rounded-lg bg-slate-800/80 backdrop-blur-sm shadow-lg shadow-gold-500/10 text-center">
          <button
            onClick={() => setIsVisible(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gold-300 transition-colors"
            aria-label="Close message"
          >
            <X size={18} />
          </button>
          <div className="font-serif text-xl md:text-2xl text-amber-300 animate-pulse tracking-wide leading-snug uppercase">
            Season Over!
            <br />
            <span className="text-lg md:text-xl">
              {seasonWinner.name} &amp; the {seasonWinner.guildName} tribe conquered Eternum.
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-gold-600/20">
            <div className="text-sm md:text-base text-amber-200 font-semibold">Time to bridge out:</div>
            <div className="text-md md:text-lg text-red-400 font-bold mt-1">{formatTimeRemaining(timeRemaining)}</div>
          </div>
        </div>
      </div>
    </>
  );
};
