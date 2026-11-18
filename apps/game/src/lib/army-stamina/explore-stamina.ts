import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { exploreStaminaCost } from "@bibliothecadao/eternum/troop-stamina";
import type { TroopType } from "@bibliothecadao/types";

/** A bar segment is one reveal by this troop, under this game's rules. */
export const exploreStaminaOf = (
  store: Pick<NativeFactStore, "require">,
  gameId: number,
  category: TroopType,
  oaths: number,
): number => exploreStaminaCost(store.require("SliceRules", { game_id: gameId }), category, oaths);
