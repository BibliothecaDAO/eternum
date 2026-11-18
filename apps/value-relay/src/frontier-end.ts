import { ShardOperator, type ShardTarget } from "@realms-world/value-ledger/shard";
import { readFrontierGames } from "./frontier-games";
import { ShardReader, type ShardConnection } from "./shard-rpc";

export async function settleEndedFrontierGames(target: ShardTarget & ShardConnection, heraldUrl: string) {
  const directory = await readFrontierGames(target, heraldUrl);
  const now = (await new ShardReader(target).header("latest")).timestamp;
  const operator = new ShardOperator(target);
  let unavailable: unknown;
  for (const game of directory.games) {
    if (game.clock.end_at > now || game.status === "Settled") continue;
    try {
      await operator.settleGame(game.game_id);
    } catch (error) {
      unavailable ??= error;
    }
  }
  if (unavailable) throw unavailable;
}
