import type { ResolvedGameMode } from "@/config/game-modes/resolved-mode";

export const getArmyFoodRequirementLabel = (resolvedWorldMode: ResolvedGameMode): "food" | "wheat" =>
  resolvedWorldMode === "blitz" ? "wheat" : "food";

export const formatArmyFoodRequirement = ({
  missingWheat,
  missingFish,
  wheatLabel,
  formatAmount,
}: {
  missingWheat: number;
  missingFish: number;
  wheatLabel: string;
  formatAmount: (amount: number) => string;
}): string => {
  const missingParts = [
    missingWheat > 0 ? `${formatAmount(missingWheat)} ${wheatLabel}` : null,
    missingFish > 0 ? `${formatAmount(missingFish)} fish` : null,
  ].filter(Boolean);

  if (missingParts.length === 0) return "";
  if (missingParts.length === 1) return missingParts[0] ?? "";

  return `${missingParts.slice(0, -1).join(", ")} and ${missingParts[missingParts.length - 1]}`;
};

interface ArmyFoodRequirement {
  wheatPayAmount: number;
  fishPayAmount: number;
}

interface ArmyFoodBalance {
  wheat: number;
  fish: number;
}

interface ArmyFoodRequirementWarning {
  missingWheat: number;
  missingFish: number;
  hasWarning: boolean;
}

const getArmyFoodRequirementWarning = ({
  costs,
  food,
}: {
  costs: ArmyFoodRequirement;
  food: ArmyFoodBalance;
}): ArmyFoodRequirementWarning => {
  const missingWheat = Math.max(0, costs.wheatPayAmount - food.wheat);
  const missingFish = Math.max(0, costs.fishPayAmount - food.fish);

  return {
    missingWheat,
    missingFish,
    hasWarning: missingWheat > 0 || missingFish > 0,
  };
};

export const getArmyMovementFoodRequirementWarnings = ({
  travelFoodCosts,
  exploreFoodCosts,
  food,
}: {
  travelFoodCosts: ArmyFoodRequirement;
  exploreFoodCosts: ArmyFoodRequirement;
  food: ArmyFoodBalance;
}) => {
  const travel = getArmyFoodRequirementWarning({ costs: travelFoodCosts, food });
  const explore = getArmyFoodRequirementWarning({ costs: exploreFoodCosts, food });

  return {
    travel,
    explore,
    combined: {
      missingWheat: Math.max(travel.missingWheat, explore.missingWheat),
      missingFish: Math.max(travel.missingFish, explore.missingFish),
      hasWarning: travel.hasWarning || explore.hasWarning,
    },
  };
};

export const getArmyStaminaRequirementWarnings = ({
  currentStamina,
  minTravelStamina,
  minExploreStamina,
}: {
  currentStamina: number;
  minTravelStamina: number;
  minExploreStamina: number;
}): { hasTravelStaminaWarning: boolean; hasExploreStaminaWarning: boolean } => ({
  hasTravelStaminaWarning: currentStamina < minTravelStamina,
  hasExploreStaminaWarning: currentStamina < minExploreStamina,
});

export const getArmyReadinessTitle = ({
  hasTravelStaminaWarning,
  hasExploreStaminaWarning,
  hasTravelFoodWarning,
  hasExploreFoodWarning,
}: {
  hasTravelStaminaWarning: boolean;
  hasExploreStaminaWarning: boolean;
  hasTravelFoodWarning: boolean;
  hasExploreFoodWarning: boolean;
}): string => {
  const travelBlocked = hasTravelStaminaWarning || hasTravelFoodWarning;
  const exploreBlocked = hasExploreStaminaWarning || hasExploreFoodWarning;

  if (travelBlocked && exploreBlocked) return "Travel and explore blocked";
  if (travelBlocked) return "Travel blocked";
  if (exploreBlocked) return "Explore blocked";

  return "Ready to travel or explore";
};

/** Tooltip for a movement-blocked stamina bar; null when travel is possible. */
export const formatTravelBlockedSummary = ({
  staminaBlocked,
  minTravelStamina,
  missingWheat,
  missingFish,
  wheatLabel,
  formatAmount,
}: {
  staminaBlocked: boolean;
  minTravelStamina: number;
  missingWheat: number;
  missingFish: number;
  wheatLabel: string;
  formatAmount: (amount: number) => string;
}): string | null => {
  const requirements = [
    staminaBlocked ? `${minTravelStamina}+ stamina` : null,
    formatArmyFoodRequirement({ missingWheat, missingFish, wheatLabel, formatAmount }) || null,
  ].filter(Boolean);

  if (requirements.length === 0) return null;

  return `Cannot travel — needs ${requirements.join(" and ")}`;
};

/**
 * The visible reason food keeps an army still: what one step costs it, what its realm holds, and that barracks training
 * takes the wheat first where it does.
 */
export const formatFoodBlock = (
  block: {
    action: "travel" | "explore";
    perStep: ArmyFoodRequirement;
    food: ArmyFoodBalance;
    trainingTakesWheat: boolean;
  },
  formatAmount: (amount: number) => string,
): string => {
  const part = (amount: number, label: string) => (amount > 0 ? `${formatAmount(amount)} ${label}` : null);
  const cost = [part(block.perStep.wheatPayAmount, "wheat"), part(block.perStep.fishPayAmount, "fish")]
    .filter(Boolean)
    .join(" and ");
  const held = [
    part(Math.max(0, block.food.wheat), "wheat") ?? (block.perStep.wheatPayAmount > 0 ? "no wheat" : null),
    block.perStep.fishPayAmount > 0 ? (part(Math.max(0, block.food.fish), "fish") ?? "no fish") : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const verb = block.action === "travel" ? "Can't march" : "Can't explore";
  const step = block.action === "travel" ? "each step" : "each explore";
  const training = block.trainingTakesWheat ? " Barracks training takes the wheat first." : "";
  return `${verb}: ${step} costs ${cost}; the realm has ${held}.${training}`;
};
