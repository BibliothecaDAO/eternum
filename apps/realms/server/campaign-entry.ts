import type { HeraldGameDirectory } from "@bibliothecadao/eternum/game-sync";
import { realmsAccountAddress } from "@realms-world/identity/account";

import { registeredShards } from "./directory";
import { ACCOUNT_CLASS_HASH, type IdentityEnv } from "./env";

/**
 * Whether the account already entered a running game of these presets, on any shard our directory lists: the relay
 * attaches a campaign ticket only when the account founds its home (apps/value-relay/src/realm-entry.ts), so a flyer
 * opened after that would be spent for nothing. Herald's `registered` is the same PlayerEntry the relay reads. Null when
 * a shard cannot answer, so the flyer waits for a retry rather than being spent on a guess.
 */
export async function hasEnteredCampaignGame(
  env: Pick<IdentityEnv, "DB" | "GUARDIAN">,
  fetchShard: typeof fetch,
  realmsId: string,
  presets: readonly number[],
): Promise<boolean | null> {
  const account = realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey());
  const shards = (await registeredShards(env.DB)).filter(({ status }) => status === "active" || status === "draining");
  const answers = await Promise.all(shards.map(({ url }) => readPlayerGames(fetchShard, url, account)));
  if (answers.some((games) => games === null)) return null;
  return answers.flat().some((game) => game !== null && isRunningCampaignGame(game, presets) && hasEntered(game));
}

type DirectoryGame = HeraldGameDirectory["games"][number];

const readPlayerGames = async (fetchShard: typeof fetch, url: string, account: string) => {
  try {
    const response = await fetchShard(`${url}/games?player=${account}`, { redirect: "manual" });
    if (!response.ok) throw new Error(`${url}/games answered ${response.status}`);
    return ((await response.json()) as HeraldGameDirectory).games;
  } catch (error) {
    console.error("campaign_entry_unavailable", url, error);
    return null;
  }
};

const isRunningCampaignGame = (game: DirectoryGame, presets: readonly number[]) =>
  presets.includes(game.preset_id) && (game.status === "Registration" || game.status === "Live");

const hasEntered = (game: DirectoryGame) => Boolean(game.player_state?.registered || game.player_state?.settled);
