import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Clock from "lucide-react/dist/esm/icons/clock";
import { memo, useEffect, useMemo, useState } from "react";

interface GameStartCountdownVisibilityInput {
  gameStartMainAt: number | null;
  currentBlockTimestamp: number;
}

export const shouldShowGameStartCountdown = ({
  gameStartMainAt,
  currentBlockTimestamp,
}: GameStartCountdownVisibilityInput): boolean => {
  return (
    typeof gameStartMainAt === "number" &&
    Number.isFinite(gameStartMainAt) &&
    gameStartMainAt > 0 &&
    Number.isFinite(currentBlockTimestamp) &&
    currentBlockTimestamp > 0 &&
    currentBlockTimestamp < gameStartMainAt
  );
};

export const formatGameStartCountdown = (secondsUntilStart: number): string => {
  const total = Math.max(0, Math.floor(secondsUntilStart));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  const minuteSecondLabel = `${minutes}m ${seconds.toString().padStart(2, "0")}s`;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}h ${minuteSecondLabel}`;
  }

  if (hours > 0) {
    return `${hours}h ${minuteSecondLabel}`;
  }

  return minuteSecondLabel;
};

export const GameStartCountdown = memo(() => {
  const gameStartMainAt = useUIStore((state) => state.gameStartMainAt);
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const [localElapsedSeconds, setLocalElapsedSeconds] = useState(0);

  useEffect(() => {
    setLocalElapsedSeconds(0);
    const intervalId = window.setInterval(() => {
      setLocalElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [currentBlockTimestamp]);

  const effectiveTimestamp = currentBlockTimestamp + localElapsedSeconds;
  const shouldShow = shouldShowGameStartCountdown({ gameStartMainAt, currentBlockTimestamp: effectiveTimestamp });
  const countdownLabel = useMemo(() => {
    if (!shouldShow || gameStartMainAt == null) {
      return null;
    }

    return formatGameStartCountdown(gameStartMainAt - effectiveTimestamp);
  }, [effectiveTimestamp, gameStartMainAt, shouldShow]);

  if (!shouldShow || !countdownLabel) {
    return null;
  }

  return (
    <div className="pointer-events-auto inline-flex h-9 md:h-10 items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3.5 md:px-4 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.18)] backdrop-blur-sm">
      <Clock className="h-3.5 w-3.5" />
      <span className="whitespace-nowrap text-[11px] md:text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/75 tabular-nums">
        Game starts in
      </span>
      <span className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.16em] text-cyan-50 tabular-nums">
        {countdownLabel}
      </span>
    </div>
  );
});

GameStartCountdown.displayName = "GameStartCountdown";
