import type { HeraldGameSnapshot } from "@bibliothecadao/eternum/game-sync";
import { aspects, type AspectId } from "@bibliothecadao/types";

import { directoryShardOf } from "./directory";
import type { IdentityEnv } from "./env";

/**
 * The Aspect an account plays for in one Season 1 game, from its shard's Herald: the Aspect of the account's own
 * realm (the snapshot's Structure rows narrowed to the account, and every home's Aspect). Null when the account has no
 * realm in an Aspect there, or the game has none. Throws while the shard is not listed or cannot answer, so a caller
 * never reads "no Aspect" from a board it could not read.
 */
export async function aspectOn(
  env: Pick<IdentityEnv, "DB">,
  fetchShard: typeof fetch,
  game: { chainId: string; gameId: number },
  account: string,
): Promise<AspectId | null> {
  const shard = await directoryShardOf(env.DB, game.chainId);
  if (!shard) throw new Error("aspect_shard_unlisted");
  const url = new URL(`/games/${game.gameId}/snapshot`, shard.url);
  url.searchParams.set("models", "Structure,HomeAspect");
  url.searchParams.set("owner", account);
  const response = await fetchShard(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("aspect_snapshot_unavailable");
  const snapshot = (await response.json()) as HeraldGameSnapshot;
  if (BigInt(snapshot.game_id) !== BigInt(game.gameId)) throw new Error("aspect_snapshot_other_game");
  const rows = (model: string) => snapshot.models.find((read) => read.model === model)?.rows ?? [];
  const homes = new Set(rows("Structure").map(({ value }) => BigInt(String(value.entity_id))));
  const joined = rows("HomeAspect").find(({ value }) => homes.has(BigInt(String(value.home))));
  const aspect = joined && Number(joined.value.aspect);
  if (aspect === undefined) return null;
  const known = aspects.find(({ id }) => id === aspect);
  if (!known) throw new Error(`aspect_unknown_${aspect}`);
  return known.id;
}
