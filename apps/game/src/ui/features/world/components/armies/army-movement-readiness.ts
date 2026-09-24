import { useMemo } from "react";

import { useGame } from "@/hooks/context/game-context";
import { useCurrentArmiesTick, useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import {
  computeExploreFoodCosts,
  computeTravelFoodCosts,
  configManager,
  divideByPrecision,
  ResourceManager,
  StaminaManager,
  storedBiomeAt,
} from "@bibliothecadao/eternum";
import { getNeighborHexes, ResourcesIds, TroopType } from "@bibliothecadao/types";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
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
/** What keeps an army from marching (or, failing that, exploring) for lack of food; see formatFoodBlock. */
export interface FoodBlock {
  action: "travel" | "explore";
  perStep: ArmyFoodCosts;
  food: { wheat: number; fish: number };
  trainingTakesWheat: boolean;
}

export interface ArmyMovementReadiness {
  canTravel: boolean;
  canExplore: boolean;
  hasTravelStaminaWarning: boolean;
  hasExploreStaminaWarning: boolean;
  foodWarnings: ReturnType<typeof getArmyMovementFoodRequirementWarnings>;
  minTravelStamina: number;
  minExploreStamina: number;
  foodBlock: FoodBlock | null;
}

export const deriveArmyMovementReadiness = ({
  currentStamina,
  minTravelStamina,
  minExploreStamina,
  travelFoodCosts,
  exploreFoodCosts,
  food,
  trainingTakesWheat = false,
}: {
  currentStamina: number;
  minTravelStamina: number;
  minExploreStamina: number;
  travelFoodCosts: ArmyFoodCosts;
  exploreFoodCosts: ArmyFoodCosts;
  food: { wheat: number; fish: number };
  trainingTakesWheat?: boolean;
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
    foodBlock: foodWarnings.travel.hasWarning
      ? { action: "travel", perStep: travelFoodCosts, food, trainingTakesWheat }
      : foodWarnings.explore.hasWarning
        ? { action: "explore", perStep: exploreFoodCosts, food, trainingTakesWheat }
        : null,
  };
};

export const useArmyMovementReadiness = (
  army: ExplorerTroopsValue | null | undefined,
  structureResources: ResourceValue | null | undefined,
): ArmyMovementReadiness | null => {
  const {
    setup: { store },
  } = useGame();
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
      minTravelStamina: resolveCheapestNeighborTravelStamina(army, store),
      minExploreStamina: configManager.getExploreStaminaCost(),
      travelFoodCosts: movementFoodCosts.travel,
      exploreFoodCosts: movementFoodCosts.explore,
      food: resolveStructureFoodBalance(structureResources, currentDefaultTick),
      trainingTakesWheat: structureResources?.hasResources() ? structureResources.trainsFromWheat() : false,
    });
  }, [army, structureResources, currentArmiesTick, currentDefaultTick, store]);
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

// Travel reaches only revealed tiles, so the cheapest step reads the neighbours' stored biomes and skips the rest.
const resolveCheapestNeighborTravelStamina = (army: ExplorerTroopsValue, store: NativeFactStore): number => {
  const neighbors = getNeighborHexes(army.coord.x, army.coord.y);
  return neighbors.reduce((min, neighbor) => {
    const biome = storedBiomeAt(store, army.coord.alt, neighbor.col, neighbor.row);
    if (!biome) return min;
    const staminaCost = configManager.getTravelStaminaCost(biome, army.troops.category as TroopType);
    return min === 0 ? staminaCost : Math.min(min, staminaCost);
  }, 0);
};
