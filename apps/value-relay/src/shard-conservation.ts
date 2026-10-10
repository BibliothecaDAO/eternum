import { cacheAnchorMatches, type CacheAnchor } from "./cache-anchor";
import { nativeGameModeOf } from "../../../config/source/common/native-preset-modes";
import { relayOperation, type MonitorPorts, type ConservationBalance } from "./ports";
import { ShardReader, sameFelt, felt, uint, type ShardConnection } from "./shard-rpc";
import { readConfirmedSnapshot, singleRow, readHeraldJson, type ConfirmedSnapshot } from "./shard-snapshot";

interface Directory {
  chain: string;
  world_address: string;
  confirmed_block: number;
  games: { game_id: number; preset_id: number; mode: string; status: string; clock: { end_at: number } }[];
}

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
      const reader = new ShardReader(connection);
      await reader.head();
      const directory = await readHeraldJson<Directory>(heraldUrl, "/games", network);
      if (
        !sameFelt(directory.chain, connection.chainId) ||
        !sameFelt(directory.world_address, connection.gamesAddress) ||
        !Array.isArray(directory.games)
      )
        throw new Error("conservation_directory_differs");
      const head = await reader.header(directory.confirmed_block);
      const cursor = cache ? ((await cache.get<number>("conservation:cursor")) ?? 0) : 0;
      const balances: ConservationBalance[] = [];
      const games = new Set<number>();
      const ordered = [...directory.games].sort((a, b) => a.game_id - b.game_id);
      const frontier = ordered.filter((game) => game.mode === "frontier");
      const remaining = frontier.filter((game) => game.game_id > cursor);
      const page = (remaining.length ? remaining : frontier).slice(0, 25);
      for (const game of ordered) {
        const gameId = Number(uint(String(game.game_id), 32));
        if (!gameId || games.has(gameId) || nativeGameModeOf(Number(uint(String(game.preset_id), 32))) !== game.mode)
          throw new Error("invalid_conservation_game");
        games.add(gameId);
        if (game.mode !== "frontier" || !page.includes(game)) continue;
        if (
          !Number.isSafeInteger(game.clock?.end_at) ||
          game.clock.end_at < 0 ||
          !["Registration", "Live", "Ended", "Settled"].includes(game.status)
        )
          throw new Error("conservation_game_clock_missing");
        const key = `conservation:final:${connection.chainId}:${connection.gamesAddress}:${gameId}`;
        const final = cache
          ? await cache.get<{ balance: ConservationBalance; shardAnchor: CacheAnchor }>(key)
          : undefined;
        if (final && (await cacheAnchorMatches(final.shardAnchor, async (n) => (await reader.header(n)).block_hash))) {
          balances.push(final.balance);
          continue;
        }
        const snapshot = await readConfirmedSnapshot(
          connection,
          heraldUrl,
          gameId,
          ["ChestRules", "LordsBudget", "LordsWithdrawal"],
          network,
        );
        if (snapshot.confirmed_block < directory.confirmed_block)
          throw new Error("conservation_snapshot_behind_directory");
        const balance = balanceOf(snapshot, gameId);
        balances.push(balance);
        const window = Number(uint(String(singleRow(snapshot, "ChestRules").claim_window_seconds), 32));
        if (cache && game.status === "Settled" && head.timestamp >= game.clock.end_at + window)
          await cache.put(key, {
            balance,
            shardAnchor: {
              number: snapshot.confirmed_block,
              hash: (await reader.header(snapshot.confirmed_block)).block_hash,
            },
          });
      }
      if (cache) await cache.put("conservation:cursor", page.length === 25 ? page.at(-1)!.game_id : 0);
      return balances;
    });

const balanceOf = (snapshot: ConfirmedSnapshot, gameId: number): ConservationBalance => {
  const rules = singleRow(snapshot, "ChestRules");
  const budget = singleRow(snapshot, "LordsBudget");
  requireFields(rules, ["game_id", "pool", "price_ceiling", "shares", "estimate_days", "claim_window_seconds"]);
  requireFields(budget, ["game_id", "pool_left", "open", "day", "price", "estimate", "rolled_shares"]);
  const pool = rowUint(rules.pool, 128);
  const poolLeft = rowUint(budget.pool_left, 128);
  for (const field of ["open", "price", "estimate", "rolled_shares"]) rowUint(budget[field], 128);
  rowUint(budget.day, 64);
  const receipts = snapshot.models.find((model) => model.model === "LordsWithdrawal")!;
  const claims = new Set<string>();
  let withdrawn = 0n;
  for (const { value } of receipts.rows) {
    requireFields(value, ["game_id", "claim_id", "account", "amount"]);
    const claim = felt(String(value.claim_id));
    const amount = rowUint(value.amount, 128);
    if (BigInt(claim) === 0n || BigInt(felt(String(value.account))) === 0n || claims.has(claim) || amount === 0n)
      throw new Error("invalid_conservation_receipt");
    claims.add(claim);
    withdrawn += amount;
  }
  return {
    gameId,
    confirmedBlock: snapshot.confirmed_block,
    receipts: String(withdrawn),
    netIssued: String(pool - poolLeft),
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
