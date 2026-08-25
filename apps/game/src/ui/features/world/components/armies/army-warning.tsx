import Route from "lucide-react/dist/esm/icons/route";
import Telescope from "lucide-react/dist/esm/icons/telescope";
import Wheat from "lucide-react/dist/esm/icons/wheat";
import type { ReactNode } from "react";

import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { cn } from "@/ui/design-system/atoms/lib/utils";
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
        icon={<Route className="h-3.5 w-3.5" />}
        active={!hasTravelStaminaWarning && !hasTravelFoodWarning}
        title={travelTitle}
      />
      <ReadinessIcon
        icon={<Telescope className="h-3.5 w-3.5" />}
        active={!hasExploreStaminaWarning && !hasExploreFoodWarning}
        title={exploreTitle}
      />
      <ReadinessIcon
        icon={<Wheat className="h-3.5 w-3.5" />}
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

const ReadinessIcon = ({ icon, active, title }: { icon: ReactNode; active: boolean; title: string }) => {
  return (
    <span
      aria-label={title}
      title={title}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
        active
          ? "border-order-brilliance/30 bg-order-brilliance/10 text-order-brilliance"
          : "border-danger/35 bg-danger/10 text-danger",
      )}
    >
      {icon}
    </span>
  );
};
