import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { realmsAccountAddress } from "@realms-world/identity/account";

import { fetchShardGames, gamesUrl, listedShards } from "./directory";
import { ACCOUNT_CLASS_HASH, type IdentityEnv } from "./env";

/**
 * Whether the account already entered a running game of these presets, on any shard our directory lists: the relay
 * attaches a campaign ticket only when the account founds its home (apps/value-relay/src/realm-entry.ts), so a flyer
 * opened after that would be spent for nothing. Herald's `registered` is the same PlayerEntry the relay reads.
 *
 * Each shard is read as the directory reads it (its timeout, its chain checked). Null when any shard cannot answer, is
 * slow or folds another chain, so the flyer waits for a retry rather than being spent on a guess.
 */
export async function hasEnteredCampaignGame(
  env: Pick<IdentityEnv, "DB" | "GUARDIAN">,
  fetchShard: typeof fetch,
  realmsId: string,
  presets: readonly number[],
): Promise<boolean | null> {
  const account = realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey());
  const answers = await Promise.all(
    (await listedShards(env.DB)).map((shard) =>
      fetchShardGames(shard, gamesUrl(shard, account), fetchShard).catch((error: unknown) => {
        console.error("campaign_entry_unavailable", shard.url, error);
        return null;
      }),
    ),
  );
  if (answers.some((games) => games === null)) return null;
  return answers.flat().some((game) => game !== null && isRunningCampaignGame(game, presets) && hasEntered(game));
}

const isRunningCampaignGame = (game: HeraldGameDirectoryEntry, presets: readonly number[]) =>
  presets.includes(game.preset_id) && (game.status === "Registration" || game.status === "Live");

const hasEntered = (game: HeraldGameDirectoryEntry) =>
  Boolean(game.player_state?.registered || game.player_state?.settled);
