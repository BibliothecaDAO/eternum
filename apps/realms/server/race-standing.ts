import type { HeraldRaceBoard } from "@bibliothecadao/eternum/game-sync";
import type { AspectId } from "@bibliothecadao/types";

import { accountKey } from "./campaign-entry";
import { listedShards } from "./directory";
import type { IdentityEnv } from "./env";

/**
 * The Aspect an account plays for in one Season 1 game, from its shard's race board (Herald's `/games/<id>/race`): null
 * when the account is in no Aspect there, or the game races none. Throws while the shard is not listed or its board
 * cannot answer, so a caller never reads "no Aspect" from a board it could not read.
 */
export async function aspectOn(
  env: Pick<IdentityEnv, "DB">,
  fetchShard: typeof fetch,
  game: { chainId: string; gameId: number },
  account: string,
): Promise<AspectId | null> {
  const shard = (await listedShards(env.DB)).find((listed) => BigInt(listed.chainId) === BigInt(game.chainId));
  if (!shard) throw new Error("race_shard_unlisted");
  const response = await fetchShard(new URL(`/games/${game.gameId}/race`, shard.url), {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("race_board_unavailable");
  const board = (await response.json()) as HeraldRaceBoard;
  if (board.mode !== "race" || BigInt(board.game_id) !== BigInt(game.gameId) || !Array.isArray(board.aspects))
    throw new Error("race_board_invalid");
  const key = accountKey(account);
  return (
    board.aspects.find(({ members }) => members.some((member) => accountKey(member.address) === key))?.aspect ?? null
  );
}
