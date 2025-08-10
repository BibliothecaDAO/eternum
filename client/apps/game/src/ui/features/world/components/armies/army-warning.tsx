import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { formatNumber } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  Biome,
  computeExploreFoodCosts,
  configManager,
  divideByPrecision,
  getArmyTotalCapacityInKg,
  getRemainingCapacityInKg,
  ResourceManager,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { ClientComponents, getNeighborHexes, ResourcesIds, TroopType } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

interface ArmyWarningProps {
  army: ComponentValue<ClientComponents["ExplorerTroops"]["schema"]>;
  explorerResources: ComponentValue<ClientComponents["Resource"]["schema"]>;
  structureResources: ComponentValue<ClientComponents["Resource"]["schema"]>;
}

export const ArmyWarning = ({ army, explorerResources, structureResources }: ArmyWarningProps) => {
  const remainingCapacity = useMemo(() => getRemainingCapacityInKg(explorerResources), [explorerResources]);
  const totalCapacity = useMemo(() => getArmyTotalCapacityInKg(explorerResources), [explorerResources]);

  const hasNoRemainingCapacityToExplore = useMemo(() => {
    return remainingCapacity < configManager.getExploreReward().resource_weight;
  }, [totalCapacity, remainingCapacity]);

  const hasNoTotalCapacityToExplore = useMemo(() => {
    return totalCapacity < configManager.getExploreReward().resource_weight;
  }, [totalCapacity]);

  const food = useMemo(() => {
    // cannot use instantiated resource manager because it uses recs, which isn't synced for all armies (only yours)
    const { balance: wheat } = ResourceManager.balanceWithProduction(
      structureResources,
      getBlockTimestamp().currentDefaultTick,
      ResourcesIds.Wheat,
    );
    const { balance: fish } = ResourceManager.balanceWithProduction(
      structureResources,
      getBlockTimestamp().currentDefaultTick,
      ResourcesIds.Fish,
    );
    return { wheat: divideByPrecision(wheat), fish: divideByPrecision(fish) };
  }, [structureResources, army.owner]);

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

  const { currentArmiesTick } = useBlockTimestamp();

  const stamina = useMemo(() => {
    return StaminaManager.getStamina(army.troops, currentArmiesTick);
  }, [army, currentArmiesTick]);

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
        <div className="text-xxs font-semibold text-center bg-danger rounded px-1 py-0.5">
          <div className="flex">
            <span className="w-5">⚠️</span>
            <span>Not enough stamina to explore/travel</span>
          </div>
        </div>
      )}
      {stamina.amount < minStaminaNeededExplore && stamina.amount >= minStaminaNeeded && (
        <div className="text-xxs font-semibold text-center bg-danger rounded px-1 py-0.5">
          <div className="flex">
            <span className="w-5">⚠️</span>
            <span>Not enough stamina to explore (min {minStaminaNeededExplore})</span>
          </div>
        </div>
      )}
      {hasNoTotalCapacityToExplore && (
        <div className="text-xxs font-semibold text-center bg-danger rounded px-1 py-0.5">
          <div className="flex">
            <span className="w-5">⚠️</span>
            <span>Need more troops to explore (min 75)</span>
          </div>
        </div>
      )}
      {!hasNoTotalCapacityToExplore && hasNoRemainingCapacityToExplore && (
        <div className="text-xxs font-semibold text-center bg-danger rounded px-1 py-0.5">
          <div className="flex">
            <span className="w-5">⚠️</span>
            <span>Too heavy to explore</span>
          </div>
        </div>
      )}
      {notEnoughFood && (
        <div className="text-xxs font-semibold text-center bg-danger rounded px-1 py-0.5">
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
