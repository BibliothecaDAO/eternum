import { useUIStore } from "@/hooks/store/use-ui-store";
import { currencyFormat, multiplyByPrecision } from "@/ui/utils/utils";
import {
    ArmyInfo,
    ArmyMovementManager,
    computeExploreFoodCosts,
    configManager,
    StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useMemo } from "react";

interface ArmyWarningProps {
  army: ArmyInfo;
}

export const ArmyWarning = ({ army }: ArmyWarningProps) => {
  const dojo = useDojo();
  const remainingCapacity = useMemo(() => army.totalCapacity - army.weight, [army]);
  const armyManager = useMemo(() => {
    return new ArmyMovementManager(dojo.setup.components, dojo.network.provider, army.entity_id);
  }, [army]);
  const food = armyManager.getFood(useUIStore.getState().currentDefaultTick);

  const exploreFoodCosts = useMemo(() => computeExploreFoodCosts(army.troops), [army]);

  const { missingWheat, missingFish, notEnoughFood } = useMemo(() => {
    const missingWheat = Math.max(0, multiplyByPrecision(exploreFoodCosts.wheatPayAmount) - food.wheat);
    const missingFish = Math.max(0, multiplyByPrecision(exploreFoodCosts.fishPayAmount) - food.fish);
    const notEnoughFood = missingWheat > 0 || missingFish > 0;
    return { missingWheat, missingFish, notEnoughFood };
  }, [exploreFoodCosts.wheatPayAmount, exploreFoodCosts.fishPayAmount, food.wheat, food.fish]);

  const stamina = useMemo(() => {
    const staminaManager = new StaminaManager(dojo.setup.components, army.entity_id);
    return staminaManager.getStamina(useUIStore.getState().currentArmiesTick);
  }, [army]);

  return (
    <div className="flex flex-col gap-0.5 mt-1 mb-1">
      {stamina.amount < configManager.getTravelStaminaCost() && (
        <div className="text-xxs font-semibold text-center bg-red rounded px-1 py-0.5">
          <div className="flex">
            <span className="w-5">⚠️</span>
            <span>Not enough stamina to explore/travel</span>
          </div>
        </div>
      )}
      {stamina.amount < configManager.getExploreStaminaCost() &&
        stamina.amount >= configManager.getTravelStaminaCost() && (
          <div className="text-xxs font-semibold text-center bg-red rounded px-1 py-0.5">
            <div className="flex">
              <span className="w-5">⚠️</span>
              <span>Not enough stamina to explore</span>
            </div>
          </div>
        )}
      {remainingCapacity < configManager.getExploreReward() && (
        <div className="text-xxs font-semibold text-center bg-red rounded px-1 py-0.5">
          <div className="flex">
            <span className="w-5">⚠️</span>
            <span>Too heavy to explore</span>
          </div>
        </div>
      )}
      {notEnoughFood && (
        <div className="text-xxs font-semibold text-center bg-red rounded px-1 py-0.5">
          <div className="flex">
            <span className="w-5">⚠️</span>
            <span>
              Missing {missingWheat > 0 && `${currencyFormat(Number(missingWheat), 0)} wheat`}
              {missingWheat > 0 && missingFish > 0 && " and "}
              {missingFish > 0 && `${currencyFormat(Number(missingFish), 0)} fish`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
