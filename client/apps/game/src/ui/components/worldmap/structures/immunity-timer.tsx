import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { Structure, formatTime, getStructureImmunityTimer, isStructureImmune } from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const ImmunityTimer = ({ structure, className }: { structure: Structure; className?: string }) => {
  const { currentBlockTimestamp } = useBlockTimestamp();

  const isImmune = useMemo(
    () => isStructureImmune(structure.structure, currentBlockTimestamp || 0),
    [structure, currentBlockTimestamp],
  );

  const timer = useMemo(
    () => getStructureImmunityTimer(structure, currentBlockTimestamp || 0),
    [structure, currentBlockTimestamp],
  );

  if (!isImmune) return null;

  return (
    <div className={`mt-2 p-2 bg-blue-500 bg-opacity-20 rounded-md ${className}`}>
      <div className="text-sm font-semibold text-blue-300">Immune</div>
      <div className="text-lg font-bold text-white animate-pulse">{formatTime(timer)}</div>
    </div>
  );
};
