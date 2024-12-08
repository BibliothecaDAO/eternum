import { buildFoodSteps } from "@/ui/components/quest/steps/buildFoodSteps";
import { buildResourceSteps } from "@/ui/components/quest/steps/buildResourceSteps";
import { createAttackArmySteps } from "@/ui/components/quest/steps/createAttackArmy";
import { createDefenseArmySteps } from "@/ui/components/quest/steps/createDefenseArmySteps";
import { createTradeSteps } from "@/ui/components/quest/steps/createTradeSteps";
import { pauseProductionSteps } from "@/ui/components/quest/steps/pauseProductionSteps";
import { settleSteps } from "@/ui/components/quest/steps/settleSteps";
import { travelSteps } from "@/ui/components/quest/steps/travelSteps";
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
