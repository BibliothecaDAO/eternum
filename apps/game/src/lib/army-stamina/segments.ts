import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

/** An army's or a slot's stamina as its bar draws it: held, its maximum, and what one explore costs. */
export type StaminaBar = { current: number; max: number; perExplore: number };

/** One segment of a stamina bar: its length (1 is one explore's worth) and how full it is, 0 to 1. */
export type StaminaSegment = { size: number; fill: number };

/** The stamina one explore costs, as the game's troop stamina rules set it. */
export const exploreStaminaOf = (store: Pick<NativeFactStore, "require">, gameId: number): number =>
  Number(store.require("SliceRules", { game_id: gameId }).troop_stamina_config.stamina_explore_stamina_cost);

/**
 * An army's stamina bar on its token and its row: a segment for each explore its own maximum holds, so a full bar
 * counts the tiles it can explore, and each explore's worth of maximum its Logistics adds is one more segment (player,
 * 25 October: 120 a bar of six, +20 one more). A maximum the explore cost does not divide ends in a shorter segment.
 * None while the army's stamina is unknown.
 */
export const staminaSegments = (stamina: StaminaBar | undefined): StaminaSegment[] => {
  if (!stamina || stamina.max <= 0 || stamina.perExplore <= 0) return [];
  const { current, max, perExplore } = stamina;
  return Array.from({ length: Math.ceil(max / perExplore) }, (_, index) => {
    const start = index * perExplore;
    const length = Math.min(perExplore, max - start);
    return { size: length / perExplore, fill: Math.min(1, Math.max(0, (current - start) / length)) };
  });
};
