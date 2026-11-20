import type { HeraldGameSnapshot } from "@bibliothecadao/eternum/game-sync";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { realmsAccountAddress } from "@realms-world/identity/account";

import { directoryShardOf } from "./directory";
import { ACCOUNT_CLASS_HASH, type IdentityEnv } from "./env";

/** playerAccount for many Realms ids, asking the guardian for its key once. */
export const playerAccounts = (env: Pick<IdentityEnv, "GUARDIAN">) => {
  let guardianKey: Promise<string> | undefined;
  return async (realmsId: string) =>
    realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, await (guardianKey ??= env.GUARDIAN.publicKey()));
};

export async function gloryOn(
  env: Pick<IdentityEnv, "DB">,
  fetchShard: typeof fetch,
  game: { chainId: string; gameId: number },
): Promise<Map<string, number> | null> {
  const shard = await directoryShardOf(env.DB, game.chainId);
  if (!shard) return null;
  try {
    return gloryByAccount(await raceSnapshot(shard.url, game.gameId, fetchShard));
  } catch {
    return null;
  }
}

/** One spelling per account address, whatever its padding or case. */
export const accountKey = (address: string) => `0x${BigInt(address).toString(16)}`;

const RACE_MODELS = ["RaceMember", "Structure"];

async function raceSnapshot(shardUrl: string, gameId: number, fetchShard: typeof fetch) {
  const url = new URL(`/games/${gameId}/snapshot`, shardUrl);
  url.searchParams.set("models", RACE_MODELS.join(","));
  const response = await fetchShard(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("race_snapshot_unavailable");
  const snapshot = (await response.json()) as HeraldGameSnapshot;
  if (BigInt(snapshot.game_id) !== BigInt(gameId)) throw new Error("race_snapshot_other_game");
  if (!RACE_MODELS.every((name) => snapshot.models.filter((model) => model.model === name).length === 1))
    throw new Error("race_snapshot_incomplete");
  return snapshot;
}

const gloryByAccount = (snapshot: HeraldGameSnapshot) => {
  const rows = (name: string) => snapshot.models.find((model) => model.model === name)?.rows ?? [];
  const ownerOf = new Map(
    rows("Structure").map(({ value }) => [BigInt(String(value.entity_id)), accountKey(String(value.owner))]),
  );
  const glory = new Map<string, number>();
  for (const { value } of rows("RaceMember")) {
    const owner = ownerOf.get(BigInt(String(value.entity_id)));
    if (owner === undefined) continue;
    glory.set(owner, (glory.get(owner) ?? 0) + Number(BigInt(String(value.glory)) / BigInt(RESOURCE_PRECISION)));
  }
  return glory;
};
