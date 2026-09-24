import type { GameRef } from "@bibliothecadao/eternum/game-client";
import type { HeraldPlayerGameState, HeraldPlayerStructure } from "@bibliothecadao/eternum/game-sync";
import { readGameEntry } from "./shard-directory";

export type PlayerStructure = HeraldPlayerStructure;

export interface SettlementSnapshot {
  hasSettlementRecord: boolean;
  hasSettledStructure: boolean;
  settledCount: number;
}

/** Before a player joins a game, the entry screens read only their own row of Herald's directory. */
const fetchPlayerGameState = async (game: GameRef, player: string): Promise<HeraldPlayerGameState> => {
  const state = (await readGameEntry(game, player)).player_state;
  if (!state) throw new Error(`Shard ${game.chainId} answers no state in game ${game.gameId} for player ${player}`);
  return state;
};

export const fetchPlayerStructures = async (game: GameRef, owner: string): Promise<PlayerStructure[]> =>
  (await fetchPlayerGameState(game, owner)).structures.toSorted(
    (left, right) => left.category - right.category || left.entity_id - right.entity_id,
  );

export const fetchSettlementSnapshot = async (game: GameRef, player: string): Promise<SettlementSnapshot> => {
  const { registered, structures } = await fetchPlayerGameState(game, player);
  return {
    hasSettlementRecord: registered,
    hasSettledStructure: structures.length > 0,
    settledCount: structures.length,
  };
};
