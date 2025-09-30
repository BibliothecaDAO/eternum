import clsx from "clsx";
import type { ReactNode } from "react";
import { memo } from "react";

import { ID, ResourcesIds } from "@bibliothecadao/types";
import {
  ActionPath,
  ActionPaths,
  ActionType,
  divideByPrecision,
} from "@bibliothecadao/eternum";

import { InfoLabel } from "./info-label";
import { CreateArmyInfo } from "./create-army-info";
import { HelpInfo } from "./help-info";
import { AttackInfo } from "./attack-info";
import { formatAmount } from "./format-amount";
import { QuestInfo } from "./quest-info";
import { ChestInfo } from "./chest-info";
import { StaminaSummary } from "./stamina-summary";

interface FoodCosts {
  wheatPayAmount: number;
  fishPayAmount: number;
}

export interface ActionFoodCosts {
  travelFoodCosts: FoodCosts;
  exploreFoodCosts: FoodCosts;
}

type BalanceGetter = (entityId: ID, resourceId: ResourcesIds) => {
  balance: number;
  resourceId: ResourcesIds;
};

interface TooltipContentProps {
  isExplored: boolean;
  actionPath: ActionPath[];
  costsPerStep: ActionFoodCosts;
  selectedEntityId: ID;
  structureEntityId: ID;
  getBalance: BalanceGetter;
}

const TooltipTitle = ({ children }: { children: ReactNode }) => {
  return (
    <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-gold/90">
      <span className="h-px flex-1 bg-gold/30" />
      <span className="px-1">{children}</span>
      <span className="h-px flex-1 bg-gold/30" />
    </div>
  );
};

export const TooltipContent = memo(
  ({
    isExplored,
    actionPath,
    costsPerStep,
    selectedEntityId,
    structureEntityId,
    getBalance,
  }: TooltipContentProps) => {
    const actionType = ActionPaths.getActionType(actionPath);
    const isTravelAction = actionType === ActionType.Explore || actionType === ActionType.Move;

    const wheatCost = isTravelAction
      ? actionType === ActionType.Explore
        ? Math.abs(costsPerStep.exploreFoodCosts.wheatPayAmount)
        : Math.abs(costsPerStep.travelFoodCosts.wheatPayAmount * (actionPath.length - 1))
      : 0;

    const wheatRawBalance = getBalance(structureEntityId, ResourcesIds.Wheat)?.balance ?? 0;
    const wheatAvailable = divideByPrecision(Number(wheatRawBalance));
    const wheatRatio = wheatCost === 0 ? Number.POSITIVE_INFINITY : wheatAvailable / wheatCost;
    const wheatStatusColor =
      wheatRatio >= 1 ? "text-order-brilliance" : wheatRatio >= 0.5 ? "text-gold" : "text-order-giants";
    const roundedWheatCost = Math.round(wheatCost);
    const displayWheatCost = roundedWheatCost === 0 ? "0" : `-${formatAmount(roundedWheatCost)}`;

    return (
      <>
        <TooltipTitle>{actionType?.toUpperCase()}</TooltipTitle>
        {isTravelAction ? (
          <div className="mt-1 flex items-center gap-2">
            <InfoLabel variant="default" className="flex-1 items-center justify-between gap-2">
              <img src={`/images/resources/${ResourcesIds.Wheat}.png`} alt="Wheat" className="h-5 w-5 object-contain" />
              <span className={clsx("text-xs font-semibold", wheatStatusColor)}>{displayWheatCost}</span>
            </InfoLabel>
            <InfoLabel variant="mine" className="flex-1 items-center justify-between gap-2">
              <span className="text-base leading-none">⚡</span>
              <StaminaSummary selectedEntityId={selectedEntityId} isExplored={isExplored} path={actionPath.slice(1)} />
            </InfoLabel>
          </div>
        ) : actionType === ActionType.Quest ? (
          <QuestInfo selectedEntityId={selectedEntityId} path={actionPath} />
        ) : actionType === ActionType.Chest ? (
          <ChestInfo />
        ) : actionType === ActionType.CreateArmy ? (
          <CreateArmyInfo />
        ) : actionType === ActionType.Help ? (
          <HelpInfo />
        ) : (
          <AttackInfo selectedEntityId={selectedEntityId} path={actionPath} />
        )}
        <InfoLabel
          variant="default"
          className="mt-2 w-full items-center justify-center text-center uppercase tracking-[0.25em] animate-pulse"
        >
          <span className="text-[10px]">Right-click to confirm</span>
        </InfoLabel>
      </>
    );
  },
);
TooltipContent.displayName = "TooltipContent";
