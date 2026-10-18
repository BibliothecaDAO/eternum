import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import type { ReactNode } from "react";

import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { formatNumber } from "@/ui/utils/utils";

import type { ArmyMovementReadiness } from "./army-movement-readiness";
import { formatArmyFoodRequirement, getArmyFoodRequirementLabel, getArmyReadinessTitle } from "./army-warning-copy";

interface ArmyWarningProps {
  readiness: ArmyMovementReadiness;
}

export const ArmyWarning = ({ readiness }: ArmyWarningProps) => {
  const gameMode = useGameModeConfig();
  const foodRequirementLabel = getArmyFoodRequirementLabel(gameMode.id);

  const { hasTravelStaminaWarning, hasExploreStaminaWarning, foodWarnings, minTravelStamina, minExploreStamina } =
    readiness;

  const hasTravelFoodWarning = foodWarnings.travel.hasWarning;
  const hasExploreFoodWarning = foodWarnings.explore.hasWarning;
  const hasWarnings = hasTravelStaminaWarning || hasExploreStaminaWarning || foodWarnings.combined.hasWarning;
  const statusTitle = getArmyReadinessTitle({
    hasTravelStaminaWarning,
    hasExploreStaminaWarning,
    hasTravelFoodWarning,
    hasExploreFoodWarning,
  });
  const missingFoodText = getMissingFoodText(foodWarnings.combined, foodRequirementLabel);
  const missingTravelFoodText = getMissingFoodText(foodWarnings.travel, foodRequirementLabel);
  const missingExploreFoodText = getMissingFoodText(foodWarnings.explore, foodRequirementLabel);

  const travelTitle = formatRequirementTitle({
    label: "Travel",
    readyLabel: "Travel ready",
    requirements: [
      hasTravelStaminaWarning ? `${minTravelStamina}+ stamina` : null,
      hasTravelFoodWarning ? missingTravelFoodText : null,
    ],
  });
  const exploreTitle = formatRequirementTitle({
    label: "Explore",
    readyLabel: "Explore ready",
    requirements: [
      hasExploreStaminaWarning ? `${minExploreStamina}+ stamina` : null,
      hasExploreFoodWarning ? missingExploreFoodText : null,
    ],
  });
  const supplyTitle = foodWarnings.combined.hasWarning ? `Missing ${missingFoodText}` : `${foodRequirementLabel} ready`;

  const statusDescription = hasWarnings
    ? missingFoodText
      ? `${statusTitle}. Missing ${missingFoodText}.`
      : statusTitle
    : `${statusTitle}. Enough ${foodRequirementLabel} and stamina.`;

  return (
    <div aria-label={statusDescription} title={statusDescription} className="flex items-center justify-end gap-1">
      <ReadinessIcon
        icon={<SemanticIcon name="route" className="h-3.5 w-3.5" />}
        active={!hasTravelStaminaWarning && !hasTravelFoodWarning}
        title={travelTitle}
      />
      <ReadinessIcon
        icon={<SemanticIcon name="watch" className="h-3.5 w-3.5" />}
        active={!hasExploreStaminaWarning && !hasExploreFoodWarning}
        title={exploreTitle}
      />
      <ReadinessIcon
        icon={<SemanticIcon name="wheat" className="h-3.5 w-3.5" />}
        active={!foodWarnings.combined.hasWarning}
        title={supplyTitle}
      />
    </div>
  );
};

const getMissingFoodText = (foodWarning: { missingWheat: number; missingFish: number }, foodRequirementLabel: string) =>
  formatArmyFoodRequirement({
    missingWheat: foodWarning.missingWheat,
    missingFish: foodWarning.missingFish,
    wheatLabel: foodRequirementLabel,
    formatAmount: (amount) => formatNumber(Number(amount), 0),
  });

const formatRequirementTitle = ({
  label,
  readyLabel,
  requirements,
}: {
  label: string;
  readyLabel: string;
  requirements: Array<string | null>;
}) => {
  const missingRequirements = requirements.filter(Boolean);

  if (missingRequirements.length === 0) return readyLabel;

  return `${label} needs ${missingRequirements.join(" and ")}`;
};

const ReadinessIcon = ({ icon, active, title }: { icon: ReactNode; active: boolean; title: string }) => (
  <span aria-label={title} title={title} className="flex shrink-0">
    <HudChip tone={active ? "good" : "bad"}>{icon}</HudChip>
  </span>
);
