import { buildFoodSteps } from "@/ui/modules/quests/steps/build-food-steps";
import { buildResourceSteps } from "@/ui/modules/quests/steps/build-resource-steps";
import { createAttackArmySteps } from "@/ui/modules/quests/steps/create-attack-army";
import { createDefenseArmySteps } from "@/ui/modules/quests/steps/create-defense-army-steps";
import { createTradeSteps } from "@/ui/modules/quests/steps/create-trade-steps";
import { pauseProductionSteps } from "@/ui/modules/quests/steps/pause-production-steps";
import { settleSteps } from "@/ui/modules/quests/steps/settle-steps";
import { travelSteps } from "@/ui/modules/quests/steps/travel-steps";
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
