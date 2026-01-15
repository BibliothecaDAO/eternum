import { formatTime } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";

interface CountdownTimerProps {
  targetTime: number;
  label?: string;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export const CountdownTimer = ({
  targetTime,
  label,
  className = "",
  showLabel = true,
  size = "md",
}: CountdownTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now() / 1000;
      const timeLeft = targetTime - now;
      setTimeRemaining(formatTime(timeLeft));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <div className={`text-center space-y-2 ${className}`}>
      {showLabel && label && <p className="text-sm text-gold/70">{label}</p>}
      <p className={`font-bold text-gold ${sizeClasses[size]}`}>{timeRemaining}</p>
    </div>
  );
};
