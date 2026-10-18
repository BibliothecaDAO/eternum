import {
  getArmyMovementFoodRequirementWarnings,
  getArmyStaminaRequirementWarnings,
} from "@/ui/design-system/kit/words";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useMemo } from "react";

import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import {
  computeExploreFoodCosts,
  computeTravelFoodCosts,
  configManager,
  divideByPrecision,
  ResourceManager,
  StaminaManager,
  storedBiomeAt,
  entityMapPosition,
} from "@bibliothecadao/eternum";
import { getNeighborHexes, ResourcesIds, TroopType } from "@bibliothecadao/types";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";

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
    foodBlock: foodWarnings.travel.hasWarning
      ? { action: "travel", perStep: travelFoodCosts, food }
      : foodWarnings.explore.hasWarning
        ? { action: "explore", perStep: exploreFoodCosts, food }
        : null,
  };
};

/** An army's movement readiness from the facts, outside React too: the world-map labels read the same answer. */
export const readArmyMovementReadiness = ({
  army,
  structureResources,
  store,
  currentDefaultTick,
}: {
  army: ExplorerTroopsValue;
  structureResources: ResourceValue | null | undefined;
  store: NativeFactStore;
  currentDefaultTick: number;
}): ArmyMovementReadiness | null => {
  const troops = resolveExplorerTroops(store, army);
  if (!troops) return null;
  const movementFoodCosts = army.owner
    ? { travel: computeTravelFoodCosts(army.troops), explore: computeExploreFoodCosts(army.troops) }
    : {
        travel: { wheatPayAmount: 0, fishPayAmount: 0 },
        explore: { wheatPayAmount: 0, fishPayAmount: 0 },
      };

  return deriveArmyMovementReadiness({
    currentStamina: Number(StaminaManager.getStamina(troops, currentDefaultTick).amount),
    minTravelStamina: resolveCheapestNeighborTravelStamina(army, store),
    minExploreStamina: configManager.getExploreStaminaCost(),
    travelFoodCosts: movementFoodCosts.travel,
    exploreFoodCosts: movementFoodCosts.explore,
    food: resolveStructureFoodBalance(structureResources, currentDefaultTick),
  });
};

export const useArmyMovementReadiness = (
  army: ExplorerTroopsValue | null | undefined,
  structureResources: ResourceValue | null | undefined,
): ArmyMovementReadiness | null => {
  const {
    setup: { store },
  } = useGame();
  const slotRevision = useNativeRevision(["ArmySlot"]);
  const currentDefaultTick = useCurrentDefaultTick();

  return useMemo(
    () => (army ? readArmyMovementReadiness({ army, structureResources, store, currentDefaultTick }) : null),
    [army, structureResources, currentDefaultTick, store, slotRevision],
  );
};

const resolveStructureFoodBalance = (
  structureResources: ResourceValue | null | undefined,
  currentDefaultTick: number,
): { wheat: number; fish: number } => {
  const wheat = structureResources?.balanceWithProduction(currentDefaultTick, ResourcesIds.Wheat);
  const fish = structureResources?.balanceWithProduction(currentDefaultTick, ResourcesIds.Fish);
  if (!wheat || !fish) {
    return { wheat: Number.POSITIVE_INFINITY, fish: Number.POSITIVE_INFINITY };
  }

  return { wheat: divideByPrecision(wheat.balance), fish: divideByPrecision(fish.balance) };
};

// Travel reaches only revealed tiles, so the cheapest step reads the neighbours' stored biomes and skips the rest.
const resolveCheapestNeighborTravelStamina = (army: ExplorerTroopsValue, store: NativeFactStore): number => {
  const position = entityMapPosition(store, army.game_id, army.explorer_id);
  const neighbors = getNeighborHexes(position.x, position.y);
  return neighbors.reduce((min, neighbor) => {
    const biome = storedBiomeAt(store, position.alt, neighbor.col, neighbor.row);
    if (!biome) return min;
    const staminaCost = configManager.getTravelStaminaCost(biome, army.troops.category as TroopType);
    return min === 0 ? staminaCost : Math.min(min, staminaCost);
  }, 0);
};
