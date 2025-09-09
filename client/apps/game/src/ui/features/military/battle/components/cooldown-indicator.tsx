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

  if (!isOnCooldown) {
    return (
      <div className={`flex flex-col items-center gap-1 p-2 rounded-md bg-green-900/20 border border-green-500/30 ${className}`}>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-green-400" />
          <span className="text-xs font-medium text-green-400">Ready to Attack</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-2 p-2 rounded-md bg-red-900/20 border border-red-500/30 ${className}`}>
      <div className="flex items-center gap-2">
        <Timer className="w-4 h-4 text-red-400 animate-pulse" />
        <span className="text-xs font-medium text-red-400">Battle Cooldown Active</span>
      </div>
      
      <div className="text-sm font-bold text-red-400">
        {formatTime(timeRemaining)} remaining
      </div>

      <div className="flex flex-col gap-1 mt-1 w-full">
        <div className="flex items-center gap-1 text-xs text-yellow-400">
          <AlertCircle className="w-3 h-3" />
          <span>Cannot initiate attacks</span>
        </div>
        {!isAttacker && (
          <div className="flex items-center gap-1 text-xs text-orange-400">
            <ShieldOff className="w-3 h-3" />
            <span>-15% damage reduction if attacked</span>
          </div>
        )}
      </div>
    </div>
  );
};