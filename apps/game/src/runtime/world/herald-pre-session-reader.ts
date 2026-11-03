import type { GameRef } from "@bibliothecadao/eternum/game-client";
import type { HeraldPlayerGameState } from "@bibliothecadao/eternum/game-sync";
import { readGameEntry } from "./shard-directory";

export interface SettlementSnapshot {
  hasSettlementRecord: boolean;
  hasSettledStructure: boolean;
  settledCount: number;
  heldRealmId: number | null;
  hasHomeSource: boolean;
  takenRealmIds: number[];
}

/** Before a player joins a game, the entry screens read only their own row of Herald's directory. */
const fetchPlayerGameState = async (game: GameRef, player: string): Promise<HeraldPlayerGameState> => {
  const state = (await readGameEntry(game, player)).player_state;
  if (!state) throw new Error(`Shard ${game.chainId} answers no state in game ${game.gameId} for player ${player}`);
  return state;
};

export const fetchSettlementSnapshot = async (game: GameRef, player: string): Promise<SettlementSnapshot> => {
  const { registered, structures, held_realm_id, has_home_source, taken_realm_ids } = await fetchPlayerGameState(
    game,
    player,
  );
  if (typeof has_home_source !== "boolean" || !Array.isArray(taken_realm_ids)) {
    throw new Error("Herald has not published home sources for this game yet.");
  }
  return {
    hasSettlementRecord: registered,
    heldRealmId: held_realm_id,
    hasHomeSource: has_home_source,
    takenRealmIds: taken_realm_ids,
    hasSettledStructure: structures.length > 0,
    settledCount: structures.length,
  };
};
