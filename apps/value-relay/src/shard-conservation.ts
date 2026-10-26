import { relayOperation, type MonitorPorts, type ConservationBalance } from "./ports";
import { felt, uint, type ShardConnection } from "./shard-rpc";
import { readConfirmedSnapshot, singleRow, optionalRow, type ConfirmedSnapshot } from "./shard-snapshot";
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
  const prizePool = prize ? rowUint(prize.pool, 128) : 0n;
  const prizeIssued = prize ? rowUint(prize.issued, 128) : 0n;
  if (prizeIssued > prizePool) throw new Error("invalid_prize_conservation");
  const pool = budget ? rowUint(budget.pool, 128) : 0n;
  const poolLeft = budget ? rowUint(budget.pool_left, 128) : 0n;
  rowUint(rules.price_ceiling, 128);
  if (budget) {
    rowUint(budget.open, 128);
    rowUint(budget.day, 64);
    rowUint(budget.price, 128);
    rowUint(budget.rolled_shares, 128);
    rowUint(budget.yesterday_shares, 128);
    rowUint(budget.yesterday_ticks, 64);
  }
  const receipts = snapshot.models.find((model) => model.model === "LordsWithdrawal")!;
  const claims = new Set<string>();
  let withdrawn = 0n;
  let prizeWithdrawn = 0n;
  for (const { value } of receipts.rows) {
    requireFields(value, ["game_id", "claim_id", "account", "amount", "prize_rank", "prize_count"]);
    const claim = felt(String(value.claim_id));
    const amount = rowUint(value.amount, 128);
    if (BigInt(claim) === 0n || BigInt(felt(String(value.account))) === 0n || claims.has(claim) || amount === 0n)
      throw new Error("invalid_conservation_receipt");
    claims.add(claim);
    withdrawn += amount;
    const rank = rowUint(value.prize_rank, 16),
      count = rowUint(value.prize_count, 16);
    if ((rank === 0n) !== (count === 0n) || rank > count || count > 100n) throw new Error("invalid_prize_rank");
    if (rank > 0n) prizeWithdrawn += amount;
  }
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

const rowUint = (value: unknown, bits: number) => {
  if (typeof value !== "string" && (typeof value !== "number" || !Number.isSafeInteger(value)))
    throw new Error("unsafe_conservation_integer");
  return uint(String(value), bits);
};
