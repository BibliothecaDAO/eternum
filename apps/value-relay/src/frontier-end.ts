import { ShardOperator, type ShardTarget } from "@realms-world/value-ledger/shard";
import { readFrontierGames } from "./frontier-games";
import { forEachGame } from "./shard-jobs";
import { ShardReader, type ShardConnection } from "./shard-rpc";

export async function settleEndedFrontierGames(target: ShardTarget & ShardConnection, heraldUrl: string) {
  const directory = await readFrontierGames(target, heraldUrl);
  const now = (await new ShardReader(target).header("latest")).timestamp;
  const operator = new ShardOperator(target);
  const ended = directory.games.filter((game) => game.clock.end_at <= now && game.status !== "Settled");
  return forEachGame(ended, (game) => operator.settleGame(game.game_id));
}
