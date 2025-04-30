import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { formatTime, getStructureImmunityTimer, isStructureImmune } from "@bibliothecadao/eternum";
import { ClientComponents } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

export const ImmunityTimer = ({
  structure,
  className,
}: {
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>;
  className?: string;
}) => {
  const { currentBlockTimestamp } = useBlockTimestamp();

  const isImmune = useMemo(() => isStructureImmune(currentBlockTimestamp || 0), [structure, currentBlockTimestamp]);

  const timer = useMemo(
    () => getStructureImmunityTimer(structure, currentBlockTimestamp || 0),
    [structure, currentBlockTimestamp],
  );

  // Calculate percentage of time remaining for progress bar
  const progressPercentage = useMemo(() => {
    if (!isImmune || !timer) return 0;
    // Assuming immunity lasts for 24 hours (86400 seconds) - adjust this value based on your game mechanics
    const totalImmunityTime = 86400;
    return Math.min(100, Math.max(0, (timer / totalImmunityTime) * 100));
  }, [isImmune, timer]);

  if (!isImmune) return null;

  return (
    <div
      className={`mt-2 p-3 bg-gradient-to-r from-blue-900/40 to-indigo-900/30 border border-blue-500/40 rounded-md ${className}`}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse mr-2"></div>
          <div className="text-sm font-semibold text-blue-300 uppercase tracking-wider">Protected</div>
        </div>
        <div className="text-xs text-blue-300/80">Immunity Shield</div>
      </div>

      {/* Timer display */}
      <div className="text-lg font-bold text-white mb-2">{formatTime(timer)}</div>

      {/* Progress bar */}
      <div className="w-full bg-gray-800/50 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-indigo-400 h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Help text */}
      <div className="mt-2 text-xs text-blue-300/70">
        This structure is protected from enemy attacks until the immunity period expires.
      </div>
    </div>
  );
};
