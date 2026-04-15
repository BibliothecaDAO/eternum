import { configManager, StaminaManager } from "@bibliothecadao/eternum";
import { TickIds, Troops } from "@bibliothecadao/types";

import { ArmyStaminaPresentation } from "./types";

export const isStaminaRecharging = (current: number, max: number): boolean => {
  if (!Number.isFinite(current) || !Number.isFinite(max)) {
    return false;
  }

  if (max <= 0) {
    return false;
  }

  return current >= 0 && current < max;
};

export const buildProjectedStaminaDisplayModel = (input: {
  committedCurrent: number;
  committedMax: number;
  armiesTickTimeRemaining: number;
  currentArmiesTick: number;
  troops?: Troops | null;
}): ArmyStaminaPresentation => {
  const committedCurrent = Number.isFinite(input.committedCurrent) ? Math.max(0, input.committedCurrent) : 0;
  const committedMax = Number.isFinite(input.committedMax) ? Math.max(0, input.committedMax) : 0;
  const committedRatio = committedMax > 0 ? Math.min(1, committedCurrent / committedMax) : 0;

  if (committedMax <= 0 || committedCurrent >= committedMax || !input.troops) {
    return {
      committedCurrent,
      committedMax,
      isRecharging: isStaminaRecharging(committedCurrent, committedMax),
      progressToNextTick: 0,
      nextTickGain: 0,
      displayCurrent: committedCurrent,
      committedRatio,
      displayRatio: committedRatio,
    };
  }

  const tickDuration = Number(configManager.getTick(TickIds.Armies));
  const safeTickDuration = Number.isFinite(tickDuration) && tickDuration > 0 ? tickDuration : 0;
  const progressToNextTick =
    safeTickDuration > 0
      ? Math.min(1, Math.max(0, (safeTickDuration - input.armiesTickTimeRemaining) / safeTickDuration))
      : 0;
  const nextTickCurrent = Number(StaminaManager.getStamina(input.troops, input.currentArmiesTick + 1).amount);
  const nextTickGain = Math.max(0, Math.min(committedMax - committedCurrent, nextTickCurrent - committedCurrent));
  const displayCurrent = committedCurrent + nextTickGain * progressToNextTick;
  const displayRatio = committedMax > 0 ? Math.min(1, Math.max(committedRatio, displayCurrent / committedMax)) : 0;

  return {
    committedCurrent,
    committedMax,
    isRecharging: nextTickGain > 0 && committedCurrent < committedMax,
    progressToNextTick,
    nextTickGain,
    displayCurrent,
    committedRatio,
    displayRatio,
  };
};
