import { nativeGameModeOf } from "../../../config/source/common/native-preset-modes";
import { ledgerInteger, type FrontierFundingTerms } from "@realms-world/value-ledger";
import { ShardReader, sameFelt, uint, type ShardConnection } from "./shard-rpc";
import { readHeraldJson, singleRow, type ConfirmedSnapshot } from "./shard-snapshot";

interface Directory {
  chain: string;
  world_address: string;
  confirmed_block: number;
  games: { game_id: number; preset_id: number; mode: string; status: string; clock: { end_at: number } }[];
}

export async function readFrontierGames(connection: ShardConnection, heraldUrl: string, network = fetch) {
  const reader = new ShardReader(connection);
  await reader.head();
  const directory = await readHeraldJson<Directory>(heraldUrl, "/games", network);
  if (
    !sameFelt(directory.chain, connection.chainId) ||
    !sameFelt(directory.world_address, connection.gamesAddress) ||
    !Array.isArray(directory.games)
  )
    throw new Error("frontier_directory_differs");
  await reader.header(directory.confirmed_block);
  const ids = new Set<number>();
  for (const game of directory.games) {
    const id = Number(uint(String(game.game_id), 32));
    if (!id || ids.has(id) || nativeGameModeOf(Number(uint(String(game.preset_id), 32))) !== game.mode)
      throw new Error("invalid_frontier_game");
    ids.add(id);
    if (
      game.mode === "frontier" &&
      (!Number.isSafeInteger(game.clock?.end_at) ||
        game.clock.end_at < 0 ||
        !["Registration", "Live", "Ended", "Settled"].includes(game.status))
    )
      throw new Error("frontier_game_clock_missing");
  }
  return {
    confirmedBlock: directory.confirmed_block,
    games: directory.games.filter((game) => game.mode === "frontier").sort((a, b) => a.game_id - b.game_id),
  };
}

export function frontierTerms(snapshot: ConfirmedSnapshot): FrontierFundingTerms {
  const game = singleRow(snapshot, "GameRegistry");
  const chests = singleRow(snapshot, "ChestRules");
  const rules = singleRow(snapshot, "SliceRules");
  return {
    start: ledgerInteger(String(game.start_main_at)),
    end: ledgerInteger(String(game.end_at)),
    seed: String(game.seed),
    dayUnit: ledgerInteger(String(rules.day_unit_seconds)),
    claimWindow: ledgerInteger(String(chests.claim_window_seconds)),
  };
}
