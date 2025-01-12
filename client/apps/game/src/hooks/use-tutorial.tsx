import { buildFoodSteps } from "@/ui/components/quest/steps/build-food-steps";
import { buildResourceSteps } from "@/ui/components/quest/steps/build-resource-steps";
import { createAttackArmySteps } from "@/ui/components/quest/steps/create-attack-army";
import { createDefenseArmySteps } from "@/ui/components/quest/steps/create-defense-army-steps";
import { createTradeSteps } from "@/ui/components/quest/steps/create-trade-steps";
import { pauseProductionSteps } from "@/ui/components/quest/steps/pause-production-steps";
import { settleSteps } from "@/ui/components/quest/steps/settle-steps";
import { travelSteps } from "@/ui/components/quest/steps/travel-steps";
import { QuestType } from "@bibliothecadao/eternum";
import { useCallback, useMemo } from "react";
import { useShepherd } from "react-shepherd";
import { StepOptions } from "shepherd.js";

export const questSteps = new Map<QuestType, StepOptions[]>([
  [QuestType.Settle, settleSteps],
  [QuestType.BuildFood, buildFoodSteps],
  [QuestType.BuildResource, buildResourceSteps],
  [QuestType.PauseProduction, pauseProductionSteps],
  [QuestType.CreateDefenseArmy, createDefenseArmySteps],
  [QuestType.CreateAttackArmy, createAttackArmySteps],
  [QuestType.Travel, travelSteps],
  [QuestType.CreateTrade, createTradeSteps],
]);

export const useTutorial = (steps: StepOptions[] | undefined) => {
  const shepherd = useShepherd();
  const tour = useMemo(
    () =>
      new shepherd.Tour({
        useModalOverlay: true,

        exitOnEsc: true,

        keyboardNavigation: false,
        defaultStepOptions: {
          arrow: true,
          cancelIcon: { enabled: true },
        },
        steps,
      }),
    [shepherd, steps],
  );

  const handleStart = useCallback(() => {
    if (!tour) return;
    tour.start();
  }, [tour]);

  return { handleStart };
};
