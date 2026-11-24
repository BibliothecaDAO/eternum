import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

import type { PickEffectBase } from "./pick-effect-format";

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
