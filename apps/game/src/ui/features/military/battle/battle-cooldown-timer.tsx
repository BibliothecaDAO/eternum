import { formatTime } from "@bibliothecadao/eternum";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";

interface BattleCooldownTimerProps {
  cooldownEnd: number;
  className?: string;
}

export const BattleCooldownTimer = ({ cooldownEnd, className = "" }: BattleCooldownTimerProps) => {
  const nowSeconds = useNowSeconds();
  const timeRemaining = Math.max(0, cooldownEnd - nowSeconds);

  if (timeRemaining === 0) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`} role="timer" aria-live="polite">
      <svg
        className="w-4 h-4 text-red-400 animate-pulse"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="text-red-400 font-semibold">Battle Cooldown: {formatTime(timeRemaining)}</span>
    </div>
  );
};
