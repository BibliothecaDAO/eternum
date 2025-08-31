import { formatNumber } from "@/shared/lib/utils";
import { ProgressCircle } from "@/shared/ui/progress-circle";
import { configManager, getArmyTotalCapacityInKg, getRemainingCapacityInKg } from "@bibliothecadao/eternum";
import { ClientComponents } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

type ArmyCapacityProps = {
  resource: ComponentValue<ClientComponents["Resource"]["schema"]> | undefined;
  className?: string;
};

export const ArmyCapacity = ({ resource, className }: ArmyCapacityProps) => {
  if (!resource) return null;

  const remainingCapacity = useMemo(() => getRemainingCapacityInKg(resource), [resource]);
  const totalCapacity = useMemo(() => getArmyTotalCapacityInKg(resource), [resource]);

  const currentWeight = useMemo(() => {
    return totalCapacity - remainingCapacity;
  }, [remainingCapacity, totalCapacity]);

  const capacityColor = useMemo(() => {
    const exploreReward = configManager.getExploreReward().resource_weight;
    const percentage = (Number(currentWeight) / Number(totalCapacity)) * 100;

    if (remainingCapacity < BigInt(Math.floor(exploreReward))) {
      return "text-red-500";
    } else if (percentage < 33) {
      return "text-green-500";
    } else if (percentage < 66) {
      return "text-yellow-500";
    } else {
      return "text-red-500";
    }
  }, [remainingCapacity, currentWeight, totalCapacity]);

  const weightPercentage = useMemo(() => {
    return (Number(currentWeight) / Number(totalCapacity)) * 100;
  }, [currentWeight, totalCapacity]);

  const valueText = `${formatNumber(Number(currentWeight) / 1000, 1)}K/${formatNumber(
    Number(totalCapacity) / 1000,
    1,
  )}K`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ProgressCircle progress={weightPercentage} size="sm" className={capacityColor} />
      <div className="text-xs">
        {valueText}
        {remainingCapacity < BigInt(Math.floor(configManager.getExploreReward().resource_weight)) && (
          <div className="text-red-500 text-xxs">Offload needed</div>
        )}
      </div>
    </div>
  );
};
