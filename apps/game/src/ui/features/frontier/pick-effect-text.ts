import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { formatPercent, formatRate, RESOURCE_PRECISION } from "@bibliothecadao/types";

export interface PickEffectBase {
  attackStamina?: number;
  revealStamina?: number;
  maxStamina?: number;
  staminaPerSecond?: number;
  deepLossPerTick?: number;
  emptyRevealLimit?: number;
}

const PICK_EFFECT_MODELS = ["SliceRules", "DeepRules", "FrontierDiscoveryRules"] as const;

export function readPickEffectBase(store: Pick<NativeFactStore, "get">, gameId: number): PickEffectBase {
  const slice = store.get("SliceRules", { game_id: gameId });
  const deep = store.get("DeepRules", { game_id: gameId });
  const discovery = store.get("FrontierDiscoveryRules", { game_id: gameId });
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
    emptyRevealLimit: discovery?.empty_reveal_limit,
  };
}

export function usePickEffectBase(): PickEffectBase {
  const { store } = useNativeFacts(PICK_EFFECT_MODELS);
  return readPickEffectBase(store, configManager.getActiveGameId());
}

export const fromToEffect = (label: string, from: string, to: string, note?: string): string =>
  note ? `${label}: ${from} → ${to} (${note})` : `${label}: ${from} → ${to}`;

export const insteadOfEffect = (lead: string, next: string, base: string): string =>
  `${lead} ${next} instead of ${base}`;

export const percentFromTo = (label: string, fromPercent: number, toPercent: number, note?: string): string =>
  fromToEffect(label, formatPercent(fromPercent / 100), formatPercent(toPercent / 100), note);

export const damageDealtEffect = (deltaPercent: number): string =>
  percentFromTo("Damage dealt", 100, 100 + deltaPercent);

export const damageTakenEffect = (reductionPercent: number, scope?: string): string =>
  percentFromTo(scope ? `Damage taken ${scope}` : "Damage taken", 100, 100 - reductionPercent, "less");

export const staminaRecoveryEffect = (basePerSecond: number | undefined, factorBps: number): string => {
  if (basePerSecond === undefined) return percentFromTo("Stamina recovery", 100, Math.round(factorBps / 100));
  return fromToEffect("Stamina recovery", formatRate(basePerSecond), formatRate((basePerSecond * factorBps) / 10_000));
};
