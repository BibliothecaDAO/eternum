import { relayOperation, type MonitorPorts, type ConservationBalance } from "./ports";
import type { ShardConnection } from "./shard-rpc";
import {
  readConfirmedSnapshot,
  singleRow,
  optionalRow,
  withdrawalTotals,
  snapshotUint,
  type ConfirmedSnapshot,
} from "./shard-snapshot";
import { readFrontierGames } from "./frontier-games";

/** One confirmed snapshot per Frontier game supplies both immutable receipts and the current net issue budget. */
export const shardConservationPort =
  (
    connection: ShardConnection,
    heraldUrl: string,
    network: typeof fetch = fetch,
    cache?: { get<T>(key: string): Promise<T | undefined>; put(key: string, value: unknown): Promise<unknown> },
  ): MonitorPorts["shard"]["conservation"] =>
  () =>
    relayOperation("audit shard LORDS conservation", async () => {
      const directory = await readFrontierGames(connection, heraldUrl, network);
      const cursor = cache ? ((await cache.get<number>(`conservation:cursor:${connection.chainId}`)) ?? 0) : 0;
      const balances: ConservationBalance[] = [];
      const remaining = directory.games.filter((game) => game.game_id > cursor);
      const page = (remaining.length ? remaining : directory.games).slice(0, 25);
      for (const game of page) {
        const gameId = game.game_id;
        const snapshot = await readConfirmedSnapshot(
          connection,
          heraldUrl,
          gameId,
          ["ChestRules", "LordsBudget", "LordsWithdrawal", "FrontierPrize"],
          network,
        );
        if (snapshot.confirmed_block < directory.confirmedBlock)
          throw new Error("conservation_snapshot_behind_directory");
        const balance = balanceOf(snapshot, gameId);
        balances.push({ ...balance, chainId: connection.chainId });
      }
      if (cache)
        await cache.put(`conservation:cursor:${connection.chainId}`, page.length === 25 ? page.at(-1)!.game_id : 0);
      return balances;
    });

const balanceOf = (snapshot: ConfirmedSnapshot, gameId: number): Omit<ConservationBalance, "chainId"> => {
  const rules = singleRow(snapshot, "ChestRules");
  const budget = optionalRow(snapshot, "LordsBudget");
  const prize = optionalRow(snapshot, "FrontierPrize");
  requireFields(rules, ["game_id", "price_ceiling", "shares", "claim_window_seconds", "pool_bps", "top_n"]);
  if (budget)
    requireFields(budget, [
      "game_id",
      "pool",
      "pool_left",
      "open",
      "day",
      "price",
      "rolled_shares",
      "yesterday_shares",
      "yesterday_ticks",
    ]);
  if (prize) requireFields(prize, ["game_id", "pool", "issued", "count"]);
  const prizePool = prize ? snapshotUint(prize.pool, 128) : 0n;
  const prizeIssued = prize ? snapshotUint(prize.issued, 128) : 0n;
  if (prizeIssued > prizePool) throw new Error("invalid_prize_conservation");
  const pool = budget ? snapshotUint(budget.pool, 128) : 0n;
  const poolLeft = budget ? snapshotUint(budget.pool_left, 128) : 0n;
  if (pool > 0n && !prize) throw new Error("frontier_prize_missing");
  snapshotUint(rules.price_ceiling, 128);
  if (budget) {
    snapshotUint(budget.open, 128);
    snapshotUint(budget.day, 64);
    snapshotUint(budget.price, 128);
    snapshotUint(budget.rolled_shares, 128);
    snapshotUint(budget.yesterday_shares, 128);
    snapshotUint(budget.yesterday_ticks, 64);
  }
  const totals = withdrawalTotals(snapshot);
  const withdrawn = totals.chest + totals.prize;
  const prizeWithdrawn = totals.prize;
  if (prizeWithdrawn !== prizeIssued) throw new Error("invalid_prize_conservation");
  return {
    gameId,
    confirmedBlock: snapshot.confirmed_block,
    pool: String(pool),
    receipts: String(withdrawn),
    netIssued: String(pool - poolLeft + prizeIssued),
  };
};

const requireFields = (value: Record<string, unknown>, fields: string[]) => {
  if (Object.keys(value).sort().join() !== [...fields].sort().join())
    throw new Error("conservation_row_schema_differs");
};
