import { ShardReader, uint, type ShardConnection } from "./shard-rpc";

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
