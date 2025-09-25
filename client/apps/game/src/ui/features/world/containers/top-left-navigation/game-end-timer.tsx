import { useUIStore } from "@/hooks/store/use-ui-store";
import { getBlockTimestamp } from "@bibliothecadao/eternum";
import { Clock } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

export const GameEndTimer = memo(() => {
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const { currentBlockTimestamp } = getBlockTimestamp();

  const [secondsRemaining, setSecondsRemaining] = useState(gameEndAt ? gameEndAt - currentBlockTimestamp : 0);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isTooltipVisible) return;

    const updateTooltip = () => {
      const hours = Math.floor(secondsRemaining / 3600);
      const minutes = Math.floor((secondsRemaining % 3600) / 60);
      const seconds = secondsRemaining % 60;

      setTooltip({
        position: "bottom",
        content: (
          <div className="whitespace-nowrap pointer-events-none flex flex-col mt-3 mb-3 text-sm capitalize">
            <div className="font-bold">Game Ends In:</div>
            <div>
              <span>{`${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`}</span>
            </div>
          </div>
        ),
      });
    };

    updateTooltip();
    const tooltipTimer = setInterval(updateTooltip, 1000);

    return () => clearInterval(tooltipTimer);
  }, [isTooltipVisible, secondsRemaining, setTooltip]);

  const { hours, minutes } = useMemo(() => {
    const hrs = Math.floor(secondsRemaining / 3600);
    const mins = Math.floor((secondsRemaining % 3600) / 60);
    return { hours: hrs, minutes: mins };
  }, [secondsRemaining]);

  const timeDisplay = useMemo(() => `${hours}h ${minutes.toString().padStart(2, "0")}m`, [hours, minutes]);

  const handleMouseEnter = useCallback(() => {
    setIsTooltipVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsTooltipVisible(false);
    setTooltip(null);
  }, [setTooltip]);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="self-center text-center px-2 py-1 flex gap-1 text-xl items-center border-l border-gold/20"
    >
      <Clock className="w-4 h-4 text-gold" />
      <span className="text-sm text-gold font-semibold font-mono w-15 text-right">{timeDisplay}</span>
    </div>
  );
});

GameEndTimer.displayName = "GameEndTimer";
