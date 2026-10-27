import { rpcAt, readFrontierFunding } from "@realms-world/value-ledger";
import { ShardOperator, type ShardTarget } from "@realms-world/value-ledger/shard";
import { frontierTerms, readFrontierGames } from "./frontier-games";
import { optionalRow, readConfirmedSnapshot } from "./shard-snapshot";
import { ShardReader, uint } from "./shard-rpc";

/** Confirmed snapshots own publication state; the contract refuses duplicate publication while Herald catches up. */
export async function publishFrontierPools(
  target: ShardTarget,
  heraldUrl: string,
  ledger: { rpcUrl: string; address: string },
) {
  const directory = await readFrontierGames(target, heraldUrl);
  const now = (await new ShardReader(target).header("latest")).timestamp;
  let unavailable: unknown;
  for (const game of directory.games) {
    if (game.clock.end_at <= now) continue;
    try {
      await publishGamePool(target, heraldUrl, ledger, game.game_id, directory.confirmedBlock);
    } catch (error) {
      unavailable ??= error;
    }
  }
  if (unavailable) throw unavailable;
}

async function publishGamePool(
  target: ShardTarget,
  heraldUrl: string,
  ledger: { rpcUrl: string; address: string },
  gameId: number,
  directoryBlock: number,
) {
  const snapshot = await readConfirmedSnapshot(target, heraldUrl, gameId, [
    "GameRegistry",
    "ChestRules",
    "SliceRules",
    "LordsBudget",
    "FrontierPrize",
  ]);
  if (snapshot.confirmed_block < directoryBlock) throw new Error("frontier_snapshot_behind_directory");
  const budget = optionalRow(snapshot, "LordsBudget");
  const existing = budget ? uint(String(budget.pool), 128) : 0n;
  const funding = await readFrontierFunding(
    rpcAt(ledger.rpcUrl),
    ledger.address,
    { chainId: target.chainId, gameId },
    frontierTerms(snapshot),
  );
  const wei = BigInt(funding.pool);
  if (funding.closed || wei <= 0n) throw new Error("invalid_frontier_deposit");
  const amount = uint(String(wei / 10n ** 18n), 128);
  const prizeWei = BigInt(funding.prizePool);
  const prize_pool = uint(String(prizeWei / 10n ** 18n), 128);
  const prize = optionalRow(snapshot, "FrontierPrize");
  if (existing > 0n && (!prize || uint(String(prize.pool), 128) !== prize_pool))
    throw new Error("frontier_prize_differs_from_ledger");
  if (existing > amount) throw new Error("frontier_pool_differs_from_ledger");
  if (existing === amount) return;
  const operator = new ShardOperator(target);
  try {
    if (existing > 0n) await operator.admin("top_up_frontier_pool", { game_id: gameId, amount });
    else await operator.admin("publish_frontier_pool", { game_id: gameId, amount, prize_pool });
  } catch (error) {
    if (!isAlreadyPublished(error)) throw error;
  }
  const confirmed = await readConfirmedSnapshot(target, heraldUrl, gameId, ["LordsBudget"]);
  const readback = optionalRow(confirmed, "LordsBudget");
  const pool = readback ? uint(String(readback.pool), 128) : 0n;
  if (pool === 0n) throw new Error("frontier_pool_confirmation_pending");
  if (pool !== amount) throw new Error("frontier_pool_differs_from_ledger");
}

const isAlreadyPublished = (error: unknown) =>
  error instanceof Error &&
  error.message === "shard_invoke_reverted" &&
  typeof error.cause === "string" &&
  error.cause.includes("Frontier pool already published");
