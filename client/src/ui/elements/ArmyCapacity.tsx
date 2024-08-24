import { ClientConfigManager } from "@/dojo/modelManager/ClientConfigManager";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
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

  const config = ClientConfigManager.instance();
  const explorationReward = config.getExploreReward();

  const remainingCapacity = useMemo(() => army.totalCapacity - army.weight, [army]);

  const capacityColor = useMemo(() => {
    if (army.weight >= army.totalCapacity) return CapacityColor.HEAVY;
    if (remainingCapacity < BigInt(explorationReward)) return CapacityColor.MEDIUM;
    return CapacityColor.LIGHT;
  }, [remainingCapacity]);

  const canExplore = remainingCapacity >= BigInt(explorationReward);

  return (
    <div>
      <div className={clsx(remainingCapacity < BigInt(explorationReward) ? "text-red" : "", className)}>
        <div className={clsx(capacityColor, className)}>
          {!canExplore && "⚠️"} Capacity: {formatNumber(Number(army.weight), 0)} /{" "}
          {formatNumber(Number(army.totalCapacity), 0)} kg
        </div>
      </div>
    </div>
  );
};
