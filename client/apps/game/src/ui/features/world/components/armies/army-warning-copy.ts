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
  notEnoughFood,
}: {
  hasTravelStaminaWarning: boolean;
  hasExploreStaminaWarning: boolean;
  notEnoughFood: boolean;
}): string => {
  if (hasTravelStaminaWarning) return "Travel and explore blocked";
  if (hasExploreStaminaWarning || notEnoughFood) return "Explore blocked";
  return "Ready to travel or explore";
};
