import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { HeraldGameDirectoryEntry, HeraldGameSnapshot } from "@bibliothecadao/eternum/game-sync";
import { realmsAccountAddress } from "@realms-world/identity/account";

import { fetchShardGames, gamesUrl, listedShards } from "./directory";
import { ACCOUNT_CLASS_HASH, type IdentityEnv } from "./env";

/** A ticket can supply a free home's first source. Unknown shard state leaves the ticket unspent. */
export async function hasCampaignHomeSource(
  env: Pick<IdentityEnv, "DB" | "GUARDIAN">,
  fetchShard: typeof fetch,
  realmsId: string,
  presets: readonly number[],
): Promise<boolean | null> {
  const account = realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey());
  const answers = await Promise.all(
    (await listedShards(env.DB)).map(async (shard) => {
      try {
        const games = await fetchShardGames(shard, gamesUrl(shard, account), fetchShard);
        const sources = await Promise.all(
          games
            .filter((game) => isRunningCampaignGame(game, presets))
            .map((game) => hasSource(shard.url, game.game_id, account, fetchShard)),
        );
        return sources.some(Boolean);
      } catch {
        return null;
      }
    }),
  );
  return answers.some((answer) => answer === null) ? null : answers.some(Boolean);
}

const isRunningCampaignGame = (game: HeraldGameDirectoryEntry, presets: readonly number[]) =>
  presets.includes(game.preset_id) && (game.status === "Registration" || game.status === "Live");

async function hasSource(shardUrl: string, gameId: number, account: string, fetchShard: typeof fetch) {
  const models = ["EntryEntitlement", "Structure", "CampaignHome", "SettledRealm"];
  const url = new URL(`/games/${gameId}/snapshot`, shardUrl);
  url.searchParams.set("models", models.join(","));
  const response = await fetchShard(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("campaign_snapshot_unavailable");
  const snapshot = (await response.json()) as HeraldGameSnapshot;
  if (
    BigInt(snapshot.game_id) !== BigInt(gameId) ||
    !Number.isSafeInteger(snapshot.confirmed_block) ||
    snapshot.confirmed_block < 0
  )
    throw new Error("campaign_snapshot_invalid");
  if (!models.every((name) => snapshot.models.filter((model) => model.model === name).length === 1))
    throw new Error("campaign_snapshot_incomplete");
  const store = new NativeFactStore();
  store.applyFacts(
    snapshot.models.flatMap(({ model, rows }) =>
      rows.map((row) => {
        if (BigInt(row.value.game_id as string) !== BigInt(gameId)) throw new Error("campaign_snapshot_game_differs");
        return { model, key: row.key, value: row.value };
      }),
    ),
  );
  if (store.get("EntryEntitlement", { game_id: gameId, owner: BigInt(account) })) return true;
  const homes = new Set(
    [...store.inGame("Structure", gameId)].filter((row) => row.owner === BigInt(account)).map((row) => row.entity_id),
  );
  return (
    [...store.inGame("CampaignHome", gameId)].some((row) => homes.has(row.home)) ||
    [...store.inGame("SettledRealm", gameId)].some((row) => homes.has(row.home))
  );
}
