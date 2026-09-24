import { Backpack as Inventory } from "@/ui/design-system/atoms/game-icons";
import { formatNumber, formatStringNumber } from "@/ui/utils/utils";
import { getArmyTotalCapacityInKg, getRemainingCapacityInKg } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { ProgressBar } from "./progress-bar";

type ArmyCapacityProps = {
  resource: NativeRows["ResourceWeight"] | undefined;
  className?: string;
};

export const ArmyCapacity = ({ resource, className }: ArmyCapacityProps) => {
  if (!resource) return null;

  const remainingCapacity = getRemainingCapacityInKg(resource);
  const totalCapacity = getArmyTotalCapacityInKg(resource);
  const currentWeight = totalCapacity - remainingCapacity;
  const weightPercentage = (Number(currentWeight) / Number(totalCapacity)) * 100;
  const capacityColor =
    weightPercentage < 33
      ? "bg-progress-bar-good"
      : weightPercentage < 66
        ? "bg-progress-bar-medium"
        : "bg-progress-bar-danger";

  const valueText = `${formatNumber(Number(currentWeight) / 1000, 1)}K/${formatNumber(
    Number(totalCapacity) / 1000,
    1,
  )}K`;

  const tooltipContent = (
    <div>
      Capacity: {formatStringNumber(Number(currentWeight), 0)} / {formatStringNumber(Number(totalCapacity), 0)} kg
    </div>
  );

  return (
    <ProgressBar
      valueText={valueText}
      percentage={weightPercentage}
      fillColor={capacityColor}
      icon={<Inventory className=" w-2 ml-0.5" />}
      tooltipContent={tooltipContent}
      className={className}
    />
  );
};
