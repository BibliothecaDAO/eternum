import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo } from "react";
import { formatNumber } from "../utils/utils";

export const ArmyCapacity = ({ army, className }: { army: ArmyInfo | undefined; className?: string }) => {
  if (!army) return null;

  const remainingCapacity = useMemo(() => army.totalCapacity - army.weight, [army]);

  return (
    <div
      className={clsx(remainingCapacity < BigInt(EternumGlobalConfig.exploration.reward) ? "text-red" : "", className)}
    >
      Capacity: {Number(army.weight)} / {formatNumber(Number(army.totalCapacity), 0)} kg
    </div>
  );
};
