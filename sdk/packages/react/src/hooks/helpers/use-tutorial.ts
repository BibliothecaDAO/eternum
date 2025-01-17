import { QuestType } from "@bibliothecadao/eternum";
import { useCallback, useMemo } from "react";
import { useShepherd } from "react-shepherd";
import { StepOptions } from "shepherd.js";
import { buildFoodSteps } from "../../constants/quests/build-food-steps";
import { buildResourceSteps } from "../../constants/quests/build-resource-steps";
import { createAttackArmySteps } from "../../constants/quests/create-attack-army";
import { createDefenseArmySteps } from "../../constants/quests/create-defense-army-steps";
import { createTradeSteps } from "../../constants/quests/create-trade-steps";
import { pauseProductionSteps } from "../../constants/quests/pause-production-steps";
import { settleSteps } from "../../constants/quests/settle-steps";
import { travelSteps } from "../../constants/quests/travel-steps";

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
