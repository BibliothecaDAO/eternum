import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { PICK_EFFECT_WORDS } from "@/ui/design-system/kit/words";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { formatPercent, formatRate, RESOURCE_PRECISION } from "@bibliothecadao/types";

export interface PickEffectBase {
  attackStamina?: number;
  revealStamina?: number;
  maxStamina?: number;
  staminaPerSecond?: number;
  deepLossPerTick?: number;
}

const PICK_EFFECT_MODELS = ["SliceRules", "DeepRules"] as const;

export function readPickEffectBase(store: Pick<NativeFactStore, "get">, gameId: number): PickEffectBase {
  const slice = store.get("SliceRules", { game_id: gameId });
  const deep = store.get("DeepRules", { game_id: gameId });
  const tickSeconds = slice ? Number(slice.tick_config.armies_tick_in_seconds) : undefined;
  return {
    attackStamina: slice?.troop_stamina_config.stamina_attack_req,
    revealStamina: slice?.troop_stamina_config.stamina_explore_stamina_cost,
    maxStamina: slice?.troop_stamina_config.stamina_knight_max,
    staminaPerSecond:
      slice && tickSeconds !== undefined
        ? slice.troop_stamina_config.stamina_gain_per_tick / Math.max(1, tickSeconds)
        : undefined,
    deepLossPerTick: deep ? Number(deep.loss_per_tick) / RESOURCE_PRECISION : undefined,
  };
}

export function usePickEffectBase(): PickEffectBase {
  const { store } = useNativeFacts(PICK_EFFECT_MODELS);
  return readPickEffectBase(store, configManager.getActiveGameId());
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
