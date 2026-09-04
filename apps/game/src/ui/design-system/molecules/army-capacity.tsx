import { ReactComponent as Inventory } from "@/assets/icons/common/bagpack.svg";
import { formatNumber, formatStringNumber } from "@/ui/utils/utils";
import { configManager, getArmyTotalCapacityInKg, getRemainingCapacityInKg } from "@bibliothecadao/eternum";
import { ClientComponents } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { ProgressBar } from "./progress-bar";

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
    // percentage is the percentage of capacity used
    const percentage = (Number(currentWeight) / Number(totalCapacity)) * 100;

    if (remainingCapacity < BigInt(Math.floor(exploreReward))) {
      return "bg-progress-bar-danger"; // Critical - can't explore
    } else if (percentage < 33) {
      return "bg-progress-bar-good"; // Good capacity (low usage)
    } else if (percentage < 66) {
      return "bg-progress-bar-medium"; // Medium capacity
    } else {
      return "bg-progress-bar-danger"; // High usage - approaching full
    }
  }, [remainingCapacity, currentWeight, totalCapacity]);

  const weightPercentage = useMemo(() => {
    return (Number(currentWeight) / Number(totalCapacity)) * 100;
  }, [currentWeight, totalCapacity]);

  const valueText = `${formatNumber(Number(currentWeight) / 1000, 1)}K/${formatNumber(
    Number(totalCapacity) / 1000,
    1,
  )}K`;

  const tooltipContent = (
    <>
      <div>
        Capacity: {formatStringNumber(Number(currentWeight), 0)} / {formatStringNumber(Number(totalCapacity), 0)} kg
      </div>
      {remainingCapacity < BigInt(Math.floor(configManager.getExploreReward().resource_weight)) && (
        <div className="text-red">Offload to continue exploring</div>
      )}
    </>
  );

  return (
    <ProgressBar
      valueText={valueText}
      percentage={weightPercentage}
      fillColor={capacityColor}
      icon={<Inventory className="fill-order-giants w-2 ml-0.5" />}
      tooltipContent={tooltipContent}
      className={className}
    />
  );
};
