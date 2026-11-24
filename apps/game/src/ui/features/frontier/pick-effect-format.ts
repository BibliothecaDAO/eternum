import { formatPercent, formatRate } from "@bibliothecadao/types";
import { PICK_EFFECT_WORDS } from "../../design-system/kit/words";

export interface PickEffectBase {
  attackStamina?: number;
  revealStamina?: number;
  maxStamina?: number;
  staminaPerSecond?: number;
  deepLossPerTick?: number;
}

export const fromToEffect = (label: string, from: string, to: string, note?: string): string =>
  note ? `${label}: ${from} → ${to} (${note})` : `${label}: ${from} → ${to}`;

export const percentFromTo = (label: string, fromPercent: number, toPercent: number, note?: string): string =>
  fromToEffect(label, formatPercent(fromPercent / 100), formatPercent(toPercent / 100), note);

export const damageDealtEffect = (deltaPercent: number): string =>
  percentFromTo(PICK_EFFECT_WORDS.damageDealt, 100, 100 + deltaPercent);

export const damageTakenEffect = (reductionPercent: number, scope?: string): string =>
  percentFromTo(
    scope ? PICK_EFFECT_WORDS.damageTakenScope(scope) : PICK_EFFECT_WORDS.damageTaken,
    100,
    100 - reductionPercent,
    PICK_EFFECT_WORDS.less,
  );

export const staminaRecoveryEffect = (basePerSecond: number | undefined, factorBps: number): string => {
  if (basePerSecond === undefined)
    return percentFromTo(PICK_EFFECT_WORDS.staminaRecovery, 100, Math.round(factorBps / 100));
  return fromToEffect(
    PICK_EFFECT_WORDS.staminaRecovery,
    formatRate(basePerSecond),
    formatRate((basePerSecond * factorBps) / 10_000),
  );
};
