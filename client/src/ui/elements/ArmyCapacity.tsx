import { ReactComponent as Inventory } from "@/assets/icons/common/bagpack.svg";
import { ClientConfigManager } from "@/dojo/modelManager/ConfigManager";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import useUIStore from "@/hooks/store/useUIStore";
import { useMemo } from "react";
import { formatNumber } from "../utils/utils";

enum CapacityColor {
  LIGHT = "bg-green",
  MEDIUM = "bg-orange",
  HEAVY = "bg-red",
}

export const ArmyCapacity = ({
  army,
  className,
  configManager,
}: {
  army: ArmyInfo | undefined;
  className?: string;
  configManager: ClientConfigManager;
}) => {
  if (!army) return null;

  const setTooltip = useUIStore((state) => state.setTooltip);
  const remainingCapacity = useMemo(() => army.totalCapacity - army.weight, [army]);

  const capacityColor = useMemo(() => {
    if (army.weight >= army.totalCapacity) return CapacityColor.HEAVY;
    if (remainingCapacity < BigInt(configManager.getExploreReward())) return CapacityColor.MEDIUM;
    return CapacityColor.LIGHT;
  }, [remainingCapacity]);

  const weightPercentage = useMemo(() => ((Number(army.weight) / Number(army.totalCapacity)) * 100).toFixed(0), [army]);

  return (
    army.totalCapacity !== 0n && (
      <div className={`flex flex-row text-xxs ${className}`}>
        <div className="mr-1">{`${formatNumber(Number(army.weight) / 1000, 1)}K/${formatNumber(
          Number(army.totalCapacity) / 1000,
          1,
        )}K`}</div>
        <div
          onMouseEnter={() => {
            setTooltip({
              content: (
                <>
                  <div>
                    Capacity: {formatNumber(Number(army.weight), 0)} / {formatNumber(Number(army.totalCapacity), 0)} kg
                  </div>
                  {capacityColor !== CapacityColor.LIGHT && (
                    <div className="text-red">Offload to continue exploring</div>
                  )}
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
    )
  );
};
