import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getIsBlitz } from "@/ui/constants";
import { configManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { Trophy, Timer, X } from "lucide-react";
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

export const GameWinnerMessage = () => {
  const {
    setup: { components },
  } = useDojo();

  const { currentBlockTimestamp } = useBlockTimestamp();

  const bridgeEndTimestamp = useMemo(() => {
    const seasonConfig = configManager.getSeasonConfig();
    return seasonConfig.endAt + seasonConfig.bridgeCloseAfterEndSeconds;
  }, [components]);

  const isBlitz = getIsBlitz();

  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = bridgeEndTimestamp - now;
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [bridgeEndTimestamp]);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const gameWinner = useUIStore((state) => state.gameWinner);
  const gameEndAt = useUIStore((state) => state.gameEndAt);

  const hasGameEnded = useMemo(() => {
    return currentBlockTimestamp > (gameEndAt ?? 0);
  }, [currentBlockTimestamp, gameEndAt]);

  if (!hasGameEnded || !isVisible) return null;

  const isBridgeClosed = timeRemaining <= 0;

  return (
    <div
      className={`fixed left-1/2 transform -translate-x-1/2 z-50 w-[360px] md:w-[520px] top-[20px] md:top-[40px] transition-all duration-500 ${isAnimating ? "scale-0 opacity-0" : "scale-100 opacity-100"}`}
    >
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-slate-900/95 to-slate-800/95 backdrop-blur-md border border-gold-400/30 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-t from-gold-500/5 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" />

        <button
          onClick={() => setIsVisible(false)}
          className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-700/80 text-gray-400 hover:text-white hover:bg-slate-600/80 transition-all duration-200 group z-10"
          aria-label="Close message"
        >
          <X size={16} className="group-hover:rotate-90 transition-transform duration-200" />
        </button>

        <div className="relative p-6">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-gradient-to-b from-gold-400/20 to-gold-600/20 border border-gold-500/30">
              <Trophy className="w-8 h-8 text-gold-400" />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-gold-300 uppercase tracking-wider">
              {isBlitz ? "Blitz Complete" : "Victory!"}
            </h2>

            {!isBlitz && gameWinner && (
              <div className="space-y-1">
                <p className="text-lg md:text-xl text-gold-200 font-medium">{gameWinner.name}</p>
                <p className="text-sm md:text-base text-gold-300/80">
                  & the <span className="font-semibold">{gameWinner.guildName}</span> tribe
                </p>
                <p className="text-sm text-gold-400/60 uppercase tracking-wide mt-2">conquered the realms</p>
              </div>
            )}
          </div>

          {!isBlitz && (
            <div className="mt-6 p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <Timer className={`w-5 h-5 ${isBridgeClosed ? "text-red-400" : "text-amber-400 animate-pulse"}`} />
                  <span className="text-sm font-medium text-slate-300">
                    {isBridgeClosed ? "Bridge Status" : "Bridge Closing In"}
                  </span>
                </div>
                <div className={`text-lg font-bold ${isBridgeClosed ? "text-red-400" : "text-amber-300"} tabular-nums`}>
                  {formatTimeRemaining(timeRemaining)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
