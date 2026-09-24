import { fetchHeraldGameDirectory, type GameRef } from "@bibliothecadao/eternum/game-client";
import type { HeraldPlayerGameState, HeraldPlayerStructure } from "@bibliothecadao/eternum/game-sync";
import { requireOpenShard } from "./shards";

export type PlayerStructure = HeraldPlayerStructure;

export interface SettlementSnapshot {
  hasSettlementRecord: boolean;
  hasSettledStructure: boolean;
  settledCount: number;
}

/** Before a player joins a game, the entry screens read only their own row of Herald's directory. */
const fetchPlayerGameState = async (game: GameRef, player: string): Promise<HeraldPlayerGameState> => {
  const shard = await requireOpenShard(game.chainId);
  const directory = await fetchHeraldGameDirectory(shard, player);
  const state = directory.games.find((entry) => entry.game_id === game.gameId)?.player_state;
  if (!state) throw new Error(`Herald ${shard.url} lists no game ${game.gameId} for player ${player}`);
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
