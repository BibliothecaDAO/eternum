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

/**
 * An army's stamina as the chain holds it: the committed amount at the current tick, never an amount between ticks
 * the contract has not granted, with the next gain and when it lands.
 */
export const buildStaminaDisplayModel = (input: {
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
      committedRatio,
      isRecharging: isStaminaRecharging(committedCurrent, committedMax),
      nextTickGain: 0,
      secondsUntilNextGain: 0,
      secondsUntilFull: 0,
    };
  }

  const tickDuration = Number(configManager.getTick(TickIds.Armies));
  const safeTickDuration = Number.isFinite(tickDuration) && tickDuration > 0 ? tickDuration : 0;
  const nextTickCurrent = Number(StaminaManager.getStamina(input.troops, input.currentArmiesTick + 1).amount);
  const nextTickGain = Math.max(0, Math.min(committedMax - committedCurrent, nextTickCurrent - committedCurrent));
  const secondsUntilNextGain = nextTickGain > 0 ? Math.max(0, input.armiesTickTimeRemaining) : 0;
  const ticksUntilFull = nextTickGain > 0 ? Math.ceil((committedMax - committedCurrent) / nextTickGain) : 0;
  const secondsUntilFull = ticksUntilFull > 0 ? secondsUntilNextGain + (ticksUntilFull - 1) * safeTickDuration : 0;

  return {
    committedCurrent,
    committedMax,
    committedRatio,
    isRecharging: nextTickGain > 0 && committedCurrent < committedMax,
    nextTickGain,
    secondsUntilNextGain,
    secondsUntilFull,
  };
};

/** The next stamina gain and when it lands, "+30 in 1:12"; null when nothing more is coming. */
export const describeNextStaminaGain = (stamina: ArmyStaminaPresentation): string | null => {
  if (stamina.nextTickGain <= 0) return null;
  const seconds = Math.ceil(stamina.secondsUntilNextGain);
  const minutes = Math.floor(seconds / 60);
  return `+${stamina.nextTickGain} in ${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};
