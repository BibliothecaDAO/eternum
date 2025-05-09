import { formatNumber } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  Biome,
  computeExploreFoodCosts,
  configManager,
  getFood,
  getRemainingCapacityInKg,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ClientComponents, getNeighborHexes, TroopType } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

interface ArmyWarningProps {
  army: ComponentValue<ClientComponents["ExplorerTroops"]["schema"]>;
  resource: ComponentValue<ClientComponents["Resource"]["schema"]>;
}

export const ArmyWarning = ({ army, resource }: ArmyWarningProps) => {
  const dojo = useDojo();
  const remainingCapacity = useMemo(() => getRemainingCapacityInKg(resource), [resource]);
  const food = getFood(resource, getBlockTimestamp().currentDefaultTick);

  const exploreFoodCosts = useMemo(
    () => (!army?.owner ? { wheatPayAmount: 0, fishPayAmount: 0 } : computeExploreFoodCosts(army.troops)),
    [army],
  );

  const { missingWheat, missingFish, notEnoughFood } = useMemo(() => {
    const missingWheat = Math.max(0, exploreFoodCosts.wheatPayAmount - food.wheat);
    const missingFish = Math.max(0, exploreFoodCosts.fishPayAmount - food.fish);
    const notEnoughFood = missingWheat > 0 || missingFish > 0;
    return { missingWheat, missingFish, notEnoughFood };
  }, [exploreFoodCosts.wheatPayAmount, exploreFoodCosts.fishPayAmount, food.wheat, food.fish]);

  const stamina = useMemo(() => {
    const staminaManager = new StaminaManager(dojo.setup.components, army.explorer_id);
    return staminaManager.getStamina(getBlockTimestamp().currentArmiesTick);
  }, [army]);

  const minStaminaNeeded = useMemo(() => {
    const neighbors = getNeighborHexes(army.coord.x, army.coord.y);
    return neighbors.reduce((min, neighbor) => {
      const staminaCost = configManager.getTravelStaminaCost(
        Biome.getBiome(neighbor.col, neighbor.row),
        army.troops.category as TroopType,
      );
      return min === 0 ? staminaCost : Math.min(min, staminaCost);
    }, 0);
  }, [army.coord.x, army.coord.y, army.troops.category]);

  const minStaminaNeededExplore = useMemo(() => {
    return configManager.getExploreStaminaCost();
  }, []);

  return (
    <div className="flex flex-col gap-0.5 mt-1 mb-1">
      {stamina.amount < minStaminaNeeded && (
        <div className="text-xxs font-semibold text-center bg-red/50 rounded px-1 py-0.5">
          <div className="flex">
            <span className="w-5">⚠️</span>
            <span>Not enough stamina to explore/travel</span>
          </div>
        </div>
      )}
      {stamina.amount < minStaminaNeededExplore && stamina.amount >= minStaminaNeeded && (
        <div className="text-xxs font-semibold text-center bg-red/50 rounded px-1 py-0.5">
          <div className="flex">
            <span className="w-5">⚠️</span>
            <span>Not enough stamina to explore (min {minStaminaNeededExplore})</span>
          </div>
        </div>
      )}
      {remainingCapacity < configManager.getExploreReward() && (
        <div className="text-xxs font-semibold text-center bg-red/50 rounded px-1 py-0.5">
          <div className="flex">
            <span className="w-5">⚠️</span>
            <span>Too heavy to explore</span>
          </div>
        </div>
      )}
      {notEnoughFood && (
        <div className="text-xxs font-semibold text-center bg-red/50 rounded px-1 py-0.5">
          <div className="flex">
            <span className="w-5">⚠️</span>
            <span>
              Missing {missingWheat > 0 && `${formatNumber(Number(missingWheat), 0)} wheat`}
              {missingWheat > 0 && missingFish > 0 && " and "}
              {missingFish > 0 && `${formatNumber(Number(missingFish), 0)} fish`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
