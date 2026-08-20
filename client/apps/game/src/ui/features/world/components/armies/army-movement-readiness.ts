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
import { ClientComponents, getNeighborHexes, ResourcesIds, TroopType } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { getArmyMovementFoodRequirementWarnings, getArmyStaminaRequirementWarnings } from "./army-warning-copy";

type ExplorerTroopsValue = ComponentValue<ClientComponents["ExplorerTroops"]["schema"]>;
type ResourceValue = ComponentValue<ClientComponents["Resource"]["schema"]>;

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

// Cannot use an instantiated resource manager here: it reads RECS, which is
// only synced for the local player's armies. An absent balance is treated as
// unbounded — an unknown balance must never paint the army blocked.
const resolveStructureFoodBalance = (
  structureResources: ResourceValue | null | undefined,
  currentDefaultTick: number,
): { wheat: number; fish: number } => {
  if (!structureResources) {
    return { wheat: Number.POSITIVE_INFINITY, fish: Number.POSITIVE_INFINITY };
  }

  const { balance: wheat } = ResourceManager.balanceWithProduction(
    structureResources,
    currentDefaultTick,
    ResourcesIds.Wheat,
  );
  const { balance: fish } = ResourceManager.balanceWithProduction(
    structureResources,
    currentDefaultTick,
    ResourcesIds.Fish,
  );

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
