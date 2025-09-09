import { formatTime } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";

interface BattleCooldownTimerProps {
  cooldownEnd: number;
  className?: string;
}

export const BattleCooldownTimer = ({ cooldownEnd, className = "" }: BattleCooldownTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState(calculateTimeRemaining());

  function calculateTimeRemaining() {
    const currentTime = Math.floor(Date.now() / 1000);
    return Math.max(0, cooldownEnd - currentTime);
  }

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);
      
      // Clear interval when cooldown expires
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownEnd]);

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
      <span className="text-red-400 font-semibold">
        Battle Cooldown: {formatTime(timeRemaining)}
      </span>
    </div>
  );
};