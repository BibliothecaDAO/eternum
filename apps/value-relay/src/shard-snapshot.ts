import { ShardReader, felt, uint, type ShardConnection } from "./shard-rpc";

export interface ConfirmedSnapshot {
  confirmed_block: number;
  game_id: string;
  models: { model: string; rows: { key: string; value: Record<string, unknown> }[] }[];
}

/** Herald's snapshot reads confirmedFold; requested models and its height are checked against the shard RPC. */
export const readConfirmedSnapshot = async (
  connection: ShardConnection,
  heraldUrl: string,
  gameId: number,
  models: readonly string[],
  network: typeof fetch = fetch,
): Promise<ConfirmedSnapshot> => {
  const snapshot = await readHeraldJson<ConfirmedSnapshot & { preconfirmed_block?: unknown }>(
    heraldUrl,
    `/games/${gameId}/snapshot?models=${models.join(",")}`,
    network,
  );
  if (
    !Number.isSafeInteger(snapshot.confirmed_block) ||
    snapshot.confirmed_block < 0 ||
    BigInt(snapshot.game_id) !== BigInt(gameId) ||
    !Array.isArray(snapshot.models) ||
    (snapshot.preconfirmed_block !== undefined && snapshot.preconfirmed_block !== null)
  )
    throw new Error("invalid_confirmed_snapshot");
  if (!models.every((name) => snapshot.models.filter((model) => model.model === name).length === 1))
    throw new Error("snapshot_model_missing");
  await new ShardReader(connection).header(snapshot.confirmed_block);
  for (const model of snapshot.models) {
    if (!Array.isArray(model.rows)) throw new Error("invalid_snapshot_rows");
    for (const row of model.rows)
      if (!row.value || typeof row.value !== "object" || uint(String(row.value.game_id), 32) !== BigInt(gameId))
        throw new Error("snapshot_game_differs");
  }
  return snapshot;
};

export const readHeraldJson = async <A>(heraldUrl: string, path: string, network: typeof fetch): Promise<A> => {
  const url = new URL(path, heraldUrl);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid_herald_url");
  const response = await network(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("confirmed_herald_read_unavailable");
  return response.json() as Promise<A>;
};

export const singleRow = (snapshot: ConfirmedSnapshot, name: string) => {
  const model = snapshot.models.find((model) => model.model === name);
  if (!model || model.rows.length !== 1) throw new Error("snapshot_row_missing");
  return model.rows[0]!.value;
};

export const optionalRow = (snapshot: ConfirmedSnapshot, name: string) => {
  const model = snapshot.models.find((model) => model.model === name);
  if (!model || model.rows.length > 1) throw new Error("snapshot_row_missing");
  return model.rows[0]?.value ?? null;
};

export function withdrawalTotals(snapshot: ConfirmedSnapshot) {
  let chest = 0n,
    prize = 0n;
  const claims = new Set<string>();
  for (const { value } of snapshot.models.find((model) => model.model === "LordsWithdrawal")!.rows) {
    if (
      Object.keys(value).sort().join() !==
      ["game_id", "claim_id", "account", "amount", "prize_rank", "prize_count"].sort().join()
    )
      throw new Error("invalid_withdrawal_snapshot");
    for (const field of [value.claim_id, value.account, value.amount, value.prize_rank, value.prize_count])
      if (typeof field !== "string" && (typeof field !== "number" || !Number.isSafeInteger(field)))
        throw new Error("invalid_withdrawal_snapshot");
    const claim = felt(String(value.claim_id));
    const amount = snapshotUint(value.amount, 128);
    const rank = snapshotUint(value.prize_rank, 16),
      count = snapshotUint(value.prize_count, 16);
    if (
      claims.has(claim) ||
      BigInt(claim) === 0n ||
      BigInt(felt(String(value.account))) === 0n ||
      amount === 0n ||
      (rank === 0n) !== (count === 0n) ||
      rank > count ||
      count > 100n
    )
      throw new Error("invalid_withdrawal_snapshot");
    claims.add(claim);
    if (rank === 0n) chest += amount;
    else prize += amount;
  }
  return { chest, prize };
}

export function snapshotUint(value: unknown, bits: number): bigint {
  if (typeof value !== "string" && (typeof value !== "number" || !Number.isSafeInteger(value)))
    throw new Error("unsafe_snapshot_integer");
  return uint(String(value), bits);
}
