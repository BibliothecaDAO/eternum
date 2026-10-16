import { Icon as SemanticIcon } from "@/ui/design-system/icon";

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
      <SemanticIcon name="hourglass" className="w-4 h-4 animate-pulse" />
      <span className="text-red-400 font-semibold">Battle Cooldown: {formatTime(timeRemaining)}</span>
    </div>
  );
};
