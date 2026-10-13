import { StaminaManager } from "@bibliothecadao/eternum";
import type { Troops } from "@bibliothecadao/types";
import type { ArmyStaminaPresentation } from "./types";

export const isStaminaRecharging = (current: number, max: number): boolean =>
  Number.isFinite(current) && Number.isFinite(max) && max > 0 && current >= 0 && current < max;

/** The displayed whole stamina and the remaining time to a full bar, on the army's own clock. */
export const buildStaminaDisplayModel = (input: {
  committedCurrent: number;
  committedMax: number;
  timestamp: number;
  troops?: Troops | null;
}): ArmyStaminaPresentation => {
  const committedCurrent = Number.isFinite(input.committedCurrent) ? Math.max(0, input.committedCurrent) : 0;
  const committedMax = Number.isFinite(input.committedMax) ? Math.max(0, input.committedMax) : 0;
  const fullAt = input.troops ? StaminaManager.getAffordableAt(input.troops, committedMax, input.timestamp) : null;
  return {
    committedCurrent,
    committedMax,
    committedRatio: committedMax > 0 ? Math.min(1, committedCurrent / committedMax) : 0,
    isRecharging: fullAt !== null && isStaminaRecharging(committedCurrent, committedMax),
    secondsUntilFull: fullAt === null ? 0 : Math.max(0, fullAt - input.timestamp),
  };
};
