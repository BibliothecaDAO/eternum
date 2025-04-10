import { ReactComponent as Inventory } from "@/assets/icons/common/bagpack.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ArmyInfo } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { formatNumber, formatStringNumber } from "../utils/utils";

enum CapacityColor {
  LIGHT = "bg-green",
  MEDIUM = "bg-orange",
  HEAVY = "bg-red",
}

type ArmyCapacityProps = {
  army: ArmyInfo | undefined;
  className?: string;
  deductedTroops?: bigint;
};

export const ArmyCapacity = ({ army, className, deductedTroops = 0n }: ArmyCapacityProps) => {
  if (!army) return null;

  const totalTroops = BigInt(army.troops.count);

  const remainingTroops = totalTroops - deductedTroops;

  const capacityRatio = Number(remainingTroops) / Number(totalTroops);

  const armyTotalCapacity = isFinite(capacityRatio) ? Number(army.totalCapacity) * capacityRatio : 0;

  const setTooltip = useUIStore((state) => state.setTooltip);
  const remainingCapacity = useMemo(() => armyTotalCapacity - army.weight, [army]);

  const capacityColor = useMemo(() => {
    const exploreReward = configManager.getExploreReward();
    if (army.weight >= armyTotalCapacity) return CapacityColor.HEAVY;
    if (remainingCapacity < BigInt(Math.floor(exploreReward))) return CapacityColor.MEDIUM;
    return CapacityColor.LIGHT;
  }, [remainingCapacity]);

  const weightPercentage = useMemo(() => {
    const percentage = ((Number(army.weight) / Number(armyTotalCapacity)) * 100).toFixed(0);
    return percentage;
  }, [army]);

  return (
    <div className={`flex flex-row text-xxs ${className}`}>
      <div className="mr-1">{`${formatNumber(Number(army.weight) / 1000, 1)}K/${formatNumber(
        Number(armyTotalCapacity) / 1000,
        1,
      )}K`}</div>
      <div
        onMouseEnter={() => {
          setTooltip({
            content: (
              <>
                <div>
                  Capacity: {formatStringNumber(Number(army.weight), 0)} /{" "}
                  {formatStringNumber(Number(armyTotalCapacity), 0)} kg
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
