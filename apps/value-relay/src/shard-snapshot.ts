import { sameFelt, uint, type ShardConnection } from "./shard-rpc";
import { rpcAt } from "./rpc";

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
  const provider = rpcAt(connection.rpcUrl);
  if (!sameFelt(await provider.getChainId(), connection.chainId)) throw new Error("snapshot_chain_differs");
  const url = new URL(`/games/${gameId}/snapshot`, heraldUrl);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid_herald_url");
  url.searchParams.set("models", models.join(","));
  const response = await network(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("confirmed_snapshot_unavailable");
  const snapshot = (await response.json()) as ConfirmedSnapshot & { preconfirmed_block?: unknown };
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
  const block = await provider.getBlock(snapshot.confirmed_block);
  if (
    !("status" in block) ||
    !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(block.status ?? "") ||
    block.block_number !== snapshot.confirmed_block
  )
    throw new Error("snapshot_head_unconfirmed");
  for (const model of snapshot.models) {
    if (!Array.isArray(model.rows)) throw new Error("invalid_snapshot_rows");
    for (const row of model.rows)
      if (!row.value || typeof row.value !== "object" || uint(String(row.value.game_id), 32) !== BigInt(gameId))
        throw new Error("snapshot_game_differs");
  }
  return snapshot;
};
export const singleRow = (snapshot: ConfirmedSnapshot, name: string) => {
  const model = snapshot.models.find((model) => model.model === name);
  if (!model || model.rows.length !== 1) throw new Error("snapshot_row_missing");
  return model.rows[0]!.value;
};
