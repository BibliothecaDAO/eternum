import { formatTime } from "@bibliothecadao/eternum";
import { AlertCircle, Shield, ShieldOff, Timer } from "lucide-react";
import { useEffect, useState } from "react";

interface CooldownIndicatorProps {
  cooldownEnd: number;
  isAttacker: boolean;
  className?: string;
}

export const CooldownIndicator = ({ cooldownEnd, isAttacker, className = "" }: CooldownIndicatorProps) => {
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      const now = Math.floor(Date.now() / 1000);
      setCurrentTime(now);
      setTimeRemaining(Math.max(0, cooldownEnd - now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [cooldownEnd]);

  const isOnCooldown = cooldownEnd > currentTime;

  return (
    <div
      className={`flex flex-col p-2 rounded-md min-h-[130px] ${
        isOnCooldown ? "bg-red-900/20 border border-red-500/30" : "bg-green-900/20 border border-green-500/30"
      } ${className}`}
    >
      {/* Header Section - Always present */}
      <div className="flex items-center justify-center gap-2 mb-2">
        {isOnCooldown ? (
          <Timer className="w-4 h-4 text-red-400 animate-pulse" />
        ) : (
          <Shield className="w-4 h-4 text-green-400" />
        )}
        <span className={`text-xs font-medium ${isOnCooldown ? "text-red-400" : "text-green-400"}`}>
          {isOnCooldown ? "Battle Cooldown Active" : "Ready to Attack"}
        </span>
      </div>

      {/* Timer Section - Only when on cooldown */}
      <div className="flex-1 flex flex-col justify-center">
        {isOnCooldown && (
          <div className="text-sm font-bold text-red-400 text-center mb-2">{formatTime(timeRemaining)} remaining</div>
        )}
      </div>

      {/* Effects Section - Fixed height area */}
      <div className="flex flex-col gap-1 min-h-[40px] justify-start">
        {isOnCooldown ? (
          <>
            <div className="flex items-center gap-1 text-xs text-yellow-400">
              <AlertCircle className="w-3 h-3" />
              <span>Cannot initiate attacks</span>
            </div>
            {!isAttacker && (
              <div className="flex items-center gap-1 text-xs text-orange-400">
                <ShieldOff className="w-3 h-3" />
                <span>-15% damage modifier if attacked</span>
              </div>
            )}
            {isAttacker && (
              // Add a placeholder div to maintain consistent height
              <div className="h-[16px]"></div>
            )}
          </>
        ) : (
          // Placeholder for consistent height when ready to attack
          <div className="h-[32px] flex items-center justify-center">
            <span className="text-xs text-green-400/60">No restrictions</span>
          </div>
        )}
      </div>
    </div>
  );
};
