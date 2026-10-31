import { frontierPrizeHolders, type HeraldFrontierLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { rpcAt, readFrontierFunding } from "@realms-world/value-ledger";
import { ShardOperator, type ShardTarget } from "@realms-world/value-ledger/shard";
import { frontierTerms, readFrontierGames } from "./frontier-games";
import { optionalRow, readConfirmedSnapshot } from "./shard-snapshot";
import { ShardReader, felt, uint, type ShardConnection } from "./shard-rpc";

/** The confirmed board fixes recipients; each award creates the same guarded withdrawal obligation as a chest. */
export async function awardFrontierPrizes(
  target: ShardTarget & ShardConnection,
  heraldUrl: string,
  ledger: { rpcUrl: string; address: string },
) {
  const directory = await readFrontierGames(target, heraldUrl);
  const reader = new ShardReader(target);
  const now = (await reader.header("latest")).timestamp;
  const operator = new ShardOperator(target);
  let unavailable: unknown;
  for (const game of directory.games) {
    if (game.clock.end_at > now) continue;
    try {
      await awardGamePrizes(target, heraldUrl, ledger, game.game_id, directory.confirmedBlock, reader, operator);
    } catch (error) {
      unavailable ??= error;
    }
  }
  if (unavailable) throw unavailable;
}

async function awardGamePrizes(
  target: ShardTarget & ShardConnection,
  heraldUrl: string,
  ledger: { rpcUrl: string; address: string },
  gameId: number,
  directoryBlock: number,
  reader: ShardReader,
  operator: ShardOperator,
) {
  const snapshot = await readConfirmedSnapshot(target, heraldUrl, gameId, [
    "GameRegistry",
    "ChestRules",
    "SliceRules",
    "FrontierPrize",
  ]);
  if (snapshot.confirmed_block < directoryBlock) throw new Error("frontier_snapshot_behind_directory");
  const prize = optionalRow(snapshot, "FrontierPrize");
  if (!prize) return;
  const count = prize.count === null ? null : Number(uint(String(prize.count), 16));
  if (count === 0 || uint(String(prize.pool), 128) === uint(String(prize.issued), 128)) return;
  const terms = frontierTerms(snapshot);
  const funding = await readFrontierFunding(
    rpcAt(ledger.rpcUrl),
    ledger.address,
    { chainId: target.chainId, gameId: gameId },
    terms,
  );
  if (funding.closed) return;
  if (uint(String(prize.pool), 128) !== BigInt(funding.prizePool) / 10n ** 18n)
    throw new Error("frontier_prize_differs_from_ledger");
  // A posted list is fixed on the ledger with its count: resume its awards, never derive the winners again.
  const places = count ?? (await postWinners(reader, heraldUrl, gameId, terms, snapshot.confirmed_block, operator));
  for (let rank = 1; rank <= places; rank++) await operator.admin("award_frontier_prize", { game_id: gameId, rank });
}

/** Fixes the season's winners on the ledger from the final board; returns how many places it pays. */
async function postWinners(
  reader: ShardReader,
  heraldUrl: string,
  gameId: number,
  terms: { end: number; topN: number },
  minimumBlock: number,
  operator: ShardOperator,
) {
  const winners = await finalWinners(reader, heraldUrl, gameId, terms.end, terms.topN, minimumBlock);
  await operator.admin("post_frontier_top", { game_id: gameId, winners });
  return winners.length;
}

async function finalWinners(
  reader: ShardReader,
  heraldUrl: string,
  gameId: number,
  end: number,
  topN: number,
  minimumBlock: number,
) {
  const url = new URL(`/games/${gameId}/leaderboard`, heraldUrl);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid_herald_url");
  const response = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("frontier_final_board_unavailable");
  const block = response.headers.get("X-Confirmed-Block");
  if (block === null) throw new Error("frontier_final_board_unconfirmed");
  const height = Number(uint(block, 53));
  const header = await reader.header(height);
  if (height < minimumBlock || header.timestamp < end) throw new Error("frontier_final_board_before_end");
  const board = (await response.json()) as HeraldFrontierLeaderboard;
  if (board.mode !== "frontier" || BigInt(board.game_id) !== BigInt(gameId) || !Array.isArray(board.entries))
    throw new Error("frontier_final_board_differs");
  const addresses = board.entries.map((entry) => felt(entry.address));
  if (new Set(addresses).size !== addresses.length || addresses.some((address) => BigInt(address) === 0n))
    throw new Error("frontier_final_board_duplicates");
  // Only a player who cleared a site is paid; with none, an empty list is posted and nothing is awarded.
  return frontierPrizeHolders(board.entries, topN).map((entry) => felt(entry.address));
}
