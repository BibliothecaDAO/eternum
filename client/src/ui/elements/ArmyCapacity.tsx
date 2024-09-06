import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo } from "react";
import { ReactComponent as Weight } from "@/assets/icons/common/weight.svg";
import useUIStore from "@/hooks/store/useUIStore";
import { formatNumber } from "../utils/utils";

enum CapacityColor {
  LIGHT = "bg-green",
  MEDIUM = "bg-orange",
  HEAVY = "bg-red",
}

export const ArmyCapacity = ({ army, className }: { army: ArmyInfo | undefined; className?: string }) => {
  if (!army) return null;

  const setTooltip = useUIStore((state) => state.setTooltip);
  const remainingCapacity = useMemo(() => army.totalCapacity - army.weight, [army]);

  const capacityColor = useMemo(() => {
    if (army.weight >= army.totalCapacity) return CapacityColor.HEAVY;
    if (remainingCapacity < BigInt(EternumGlobalConfig.exploration.reward)) return CapacityColor.MEDIUM;
    return CapacityColor.LIGHT;
  }, [remainingCapacity]);

  const weightPercentage = useMemo(() => ((Number(army.weight) / Number(army.totalCapacity)) * 100).toFixed(0), [army]);

  return (
    army.totalCapacity !== 0n && (
      <div
        onMouseEnter={() => {
          setTooltip({
            content: (
              <>
                <div>
                  Capacity: {formatNumber(Number(army.weight), 0)} / {formatNumber(Number(army.totalCapacity), 0)} kg
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
        className={clsx(`flex flex-col text-xs font-bold uppercase self-center ${className} mt-5`)}
      >
        <div className="flex flex-row items-center">
          <div className="bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 border border-y w-16">
            <div className={`${capacityColor} h-1 rounded-full`} style={{ width: `${weightPercentage}%` }}></div>
          </div>

          <Weight className="fill-gold w-3 ml-1" />
        </div>
      </div>
    )
  );
};
