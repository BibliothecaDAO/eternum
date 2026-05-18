import Route from "lucide-react/dist/esm/icons/route";
import Telescope from "lucide-react/dist/esm/icons/telescope";
import Wheat from "lucide-react/dist/esm/icons/wheat";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatNumber } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import {
  Biome,
  computeExploreFoodCosts,
  configManager,
  divideByPrecision,
  ResourceManager,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { ClientComponents, getNeighborHexes, ResourcesIds, TroopType } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import {
  formatArmyFoodRequirement,
  getArmyFoodRequirementLabel,
  getArmyReadinessTitle,
  getArmyStaminaRequirementWarnings,
} from "./army-warning-copy";

interface ArmyWarningProps {
  army: ComponentValue<ClientComponents["ExplorerTroops"]["schema"]>;
  explorerResources: ComponentValue<ClientComponents["Resource"]["schema"]>;
  structureResources: ComponentValue<ClientComponents["Resource"]["schema"]>;
  currentArmiesTick?: number;
}

export const ArmyWarning = ({
  army,
  explorerResources,
  structureResources,
  currentArmiesTick: currentArmiesTickProp,
}: ArmyWarningProps) => {
  const gameMode = useGameModeConfig();
  const foodRequirementLabel = getArmyFoodRequirementLabel(gameMode.id);

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

  const storeArmiesTick = useBlockTimestampStore((state) => state.currentArmiesTick);
  const currentArmiesTick = currentArmiesTickProp ?? storeArmiesTick;

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

  const { hasTravelStaminaWarning, hasExploreStaminaWarning } = getArmyStaminaRequirementWarnings({
    currentStamina: Number(stamina.amount),
    minTravelStamina: minStaminaNeeded,
    minExploreStamina: minStaminaNeededExplore,
  });

  const hasWarnings = hasTravelStaminaWarning || hasExploreStaminaWarning || notEnoughFood;
  const statusTitle = getArmyReadinessTitle({
    hasTravelStaminaWarning,
    hasExploreStaminaWarning,
    notEnoughFood,
  });
  const missingFoodText = formatArmyFoodRequirement({
    missingWheat,
    missingFish,
    wheatLabel: foodRequirementLabel,
    formatAmount: (amount) => formatNumber(Number(amount), 0),
  });
  const statusDescription = hasWarnings
    ? missingFoodText
      ? `${statusTitle}. Missing ${missingFoodText}.`
      : statusTitle
    : `${statusTitle}. Enough ${foodRequirementLabel} and stamina.`;

  return (
    <div aria-label={statusDescription} title={statusDescription} className="flex items-center justify-end gap-1">
      <ReadinessIcon
        icon={<Route className="h-3.5 w-3.5" />}
        active={!hasTravelStaminaWarning}
        title={hasTravelStaminaWarning ? `Travel needs ${minStaminaNeeded}+ stamina` : "Travel ready"}
      />
      <ReadinessIcon
        icon={<Telescope className="h-3.5 w-3.5" />}
        active={!hasExploreStaminaWarning && !notEnoughFood}
        title={
          hasExploreStaminaWarning
            ? `Explore needs ${minStaminaNeededExplore}+ stamina`
            : notEnoughFood
              ? `Explore needs ${foodRequirementLabel}`
              : "Explore ready"
        }
      />
      <ReadinessIcon
        icon={<Wheat className="h-3.5 w-3.5" />}
        active={!notEnoughFood}
        title={notEnoughFood ? `Missing ${missingFoodText}` : `${foodRequirementLabel} ready`}
      />
    </div>
  );
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
