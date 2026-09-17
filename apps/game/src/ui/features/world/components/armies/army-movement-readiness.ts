import { useMemo } from "react";

import { useCurrentArmiesTick, useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import {
  computeExploreFoodCosts,
  computeTravelFoodCosts,
  configManager,
  divideByPrecision,
  ResourceManager,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { getNeighborHexes, ResourcesIds, TroopType } from "@bibliothecadao/types";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { getArmyMovementFoodRequirementWarnings, getArmyStaminaRequirementWarnings } from "./army-warning-copy";

type ExplorerTroopsValue = NativeRows["ExplorerTroops"];
type ResourceValue = ResourceManager;

interface ArmyFoodCosts {
  wheatPayAmount: number;
  fishPayAmount: number;
}

/**
 * The single source of truth for "can this army take a move action right
 * now" — stamina and food together. The stamina bar's color and the
 * readiness icons both render from this; nothing re-derives it locally.
 */
export interface ArmyMovementReadiness {
  canTravel: boolean;
  canExplore: boolean;
  hasTravelStaminaWarning: boolean;
  hasExploreStaminaWarning: boolean;
  foodWarnings: ReturnType<typeof getArmyMovementFoodRequirementWarnings>;
  minTravelStamina: number;
  minExploreStamina: number;
}

export const deriveArmyMovementReadiness = ({
  currentStamina,
  minTravelStamina,
  minExploreStamina,
  travelFoodCosts,
  exploreFoodCosts,
  food,
}: {
  currentStamina: number;
  minTravelStamina: number;
  minExploreStamina: number;
  travelFoodCosts: ArmyFoodCosts;
  exploreFoodCosts: ArmyFoodCosts;
  food: { wheat: number; fish: number };
}): ArmyMovementReadiness => {
  const foodWarnings = getArmyMovementFoodRequirementWarnings({ travelFoodCosts, exploreFoodCosts, food });
  const { hasTravelStaminaWarning, hasExploreStaminaWarning } = getArmyStaminaRequirementWarnings({
    currentStamina,
    minTravelStamina,
    minExploreStamina,
  });

  return {
    canTravel: !hasTravelStaminaWarning && !foodWarnings.travel.hasWarning,
    canExplore: !hasExploreStaminaWarning && !foodWarnings.explore.hasWarning,
    hasTravelStaminaWarning,
    hasExploreStaminaWarning,
    foodWarnings,
    minTravelStamina,
    minExploreStamina,
  };
};

export const useArmyMovementReadiness = (
  army: ExplorerTroopsValue | null | undefined,
  structureResources: ResourceValue | null | undefined,
): ArmyMovementReadiness | null => {
  const currentArmiesTick = useCurrentArmiesTick();
  const currentDefaultTick = useCurrentDefaultTick();

  return useMemo(() => {
    if (!army) return null;

    const movementFoodCosts = army.owner
      ? { travel: computeTravelFoodCosts(army.troops), explore: computeExploreFoodCosts(army.troops) }
      : {
          travel: { wheatPayAmount: 0, fishPayAmount: 0 },
          explore: { wheatPayAmount: 0, fishPayAmount: 0 },
        };

    return deriveArmyMovementReadiness({
      currentStamina: Number(StaminaManager.getStamina(army.troops, currentArmiesTick).amount),
      minTravelStamina: resolveCheapestNeighborTravelStamina(army),
      minExploreStamina: configManager.getExploreStaminaCost(),
      travelFoodCosts: movementFoodCosts.travel,
      exploreFoodCosts: movementFoodCosts.explore,
      food: resolveStructureFoodBalance(structureResources, currentDefaultTick),
    });
  }, [army, structureResources, currentArmiesTick, currentDefaultTick]);
};

const resolveStructureFoodBalance = (
  structureResources: ResourceValue | null | undefined,
  currentDefaultTick: number,
): { wheat: number; fish: number } => {
  if (!structureResources?.hasResources()) {
    return { wheat: Number.POSITIVE_INFINITY, fish: Number.POSITIVE_INFINITY };
  }

  const { balance: wheat } = structureResources.balanceWithProduction(currentDefaultTick, ResourcesIds.Wheat);
  const { balance: fish } = structureResources.balanceWithProduction(currentDefaultTick, ResourcesIds.Fish);

  return { wheat: divideByPrecision(wheat), fish: divideByPrecision(fish) };
};

const resolveCheapestNeighborTravelStamina = (army: ExplorerTroopsValue): number => {
  const neighbors = getNeighborHexes(army.coord.x, army.coord.y);
  return neighbors.reduce((min, neighbor) => {
    const staminaCost = configManager.getTravelStaminaCost(
      configManager.getBiome(neighbor.col, neighbor.row),
      army.troops.category as TroopType,
    );
    return min === 0 ? staminaCost : Math.min(min, staminaCost);
  }, 0);
};
