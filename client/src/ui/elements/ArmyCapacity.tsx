import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo } from "react";
import { formatNumber } from "../utils/utils";

enum CapacityColor {
  LIGHT = "text-green",
  MEDIUM = "text-orange",
  HEAVY = "text-red",
}

export const ArmyCapacity = ({ army, className }: { army: ArmyInfo | undefined; className?: string }) => {
  if (!army) return null;

  const remainingCapacity = useMemo(() => army.totalCapacity - army.weight, [army]);

  const capacityColor = useMemo(() => {
    if (army.weight >= army.totalCapacity) return CapacityColor.HEAVY;
    if (remainingCapacity < BigInt(EternumGlobalConfig.exploration.reward)) return CapacityColor.MEDIUM;
    return CapacityColor.LIGHT;
  }, [remainingCapacity]);

  const canExplore = remainingCapacity >= BigInt(EternumGlobalConfig.exploration.reward);

  return (
    army.totalCapacity !== 0n && (
      <div>
        <div
          className={clsx(
            remainingCapacity < BigInt(EternumGlobalConfig.exploration.reward) ? "text-red" : "",
            className,
          )}
        >
          <div className={clsx(capacityColor, className)}>
            {!canExplore && "⚠️"} Capacity: {formatNumber(Number(army.weight), 0)} /{" "}
            {formatNumber(Number(army.totalCapacity), 0)} kg
          </div>
        </div>
      </div>
    )
  );
};
