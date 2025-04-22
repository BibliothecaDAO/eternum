import { ReactComponent as Inventory } from "@/assets/icons/common/bagpack.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager, getArmyTotalCapacityInKg, getRemainingCapacityInKg } from "@bibliothecadao/eternum";
import { ClientComponents } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { formatNumber, formatStringNumber } from "../utils/utils";

enum CapacityColor {
  LIGHT = "bg-green",
  MEDIUM = "bg-orange",
  HEAVY = "bg-red",
}

type ArmyCapacityProps = {
  resource: ComponentValue<ClientComponents["Resource"]["schema"]> | undefined;
  className?: string;
};

export const ArmyCapacity = ({ resource, className }: ArmyCapacityProps) => {
  if (!resource) return null;

  const setTooltip = useUIStore((state) => state.setTooltip);
  const remainingCapacity = useMemo(() => getRemainingCapacityInKg(resource), [resource]);
  const totalCapacity = useMemo(() => getArmyTotalCapacityInKg(resource), [resource]);

  const currentWeight = useMemo(() => {
    return totalCapacity - remainingCapacity;
  }, [remainingCapacity, totalCapacity]);

  const capacityColor = useMemo(() => {
    const exploreReward = configManager.getExploreReward();
    if (remainingCapacity < BigInt(Math.floor(exploreReward))) return CapacityColor.HEAVY;
    return CapacityColor.LIGHT;
  }, [remainingCapacity]);

  const weightPercentage = useMemo(() => {
    const percentage = ((Number(currentWeight) / Number(totalCapacity)) * 100).toFixed(0);
    return percentage;
  }, [currentWeight, totalCapacity]);

  return (
    <div className={`flex flex-row text-xxs ${className}`}>
      <div className="mr-1">{`${formatNumber(Number(currentWeight) / 1000, 1)}K/${formatNumber(
        Number(totalCapacity) / 1000,
        1,
      )}K`}</div>
      <div
        onMouseEnter={() => {
          setTooltip({
            content: (
              <>
                <div>
                  Capacity: {formatStringNumber(Number(remainingCapacity), 0)} /{" "}
                  {formatStringNumber(Number(totalCapacity), 0)} kg
                </div>
                {capacityColor !== CapacityColor.LIGHT && <div className="text-red">Offload to continue exploring</div>}
              </>
            ),
            position: "right",
          });
        }}
        onMouseLeave={() => {
          setTooltip(null);
        }}
        className={`flex flex-col text-xs font-bold uppercase self-center`}
      >
        <div className="bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 border border-y w-16">
          <div
            className={`${capacityColor} h-1 rounded-full`}
            style={{ width: `${Math.min(Number(weightPercentage), 100)}%` }}
          ></div>
        </div>
      </div>
      <Inventory className="fill-order-giants w-2 ml-1" />
    </div>
  );
};
