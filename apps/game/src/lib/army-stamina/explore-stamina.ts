import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

/** The stamina one explore costs, as the game's troop stamina rules set it: one segment of every stamina bar. */
export const exploreStaminaOf = (store: Pick<NativeFactStore, "require">, gameId: number): number =>
  Number(store.require("SliceRules", { game_id: gameId }).troop_stamina_config.stamina_explore_stamina_cost);
