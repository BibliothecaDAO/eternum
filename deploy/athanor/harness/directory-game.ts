import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";

/** Select the same live Frontier game a player sees, before creating any bot accounts. */
export async function listedFrontierGame(
  identityUrl: string,
  shard: { chainId: string },
  heraldUrl: string,
  presetId: number,
  gameId?: number,
) {
  const url = `${identityUrl.replace(/\/$/, "")}/directory`;
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Gameplay directory read: HTTP ${response.status}`);
  const directory = (await response.json()) as {
    shards: { chainId: string; url: string; status: string; games: HeraldGameDirectoryEntry[] | null }[];
  };
  const listed = directory.shards.find(
    (row) => BigInt(row.chainId) === BigInt(shard.chainId) && new URL(row.url).origin === new URL(heraldUrl).origin,
  );
  const games = listed?.status === "active" ? listed.games : null;
  const candidates = (games ?? []).filter(
    (game) =>
      game.mode === "frontier" &&
      game.status === "Live" &&
      game.preset_id === presetId &&
      (gameId === undefined || game.game_id === gameId),
  );
  console.log(
    JSON.stringify({
      event: "gameplay_directory",
      url,
      chainId: shard.chainId,
      status: listed?.status ?? "unlisted",
      games: candidates.map(({ game_id, name, status }) => ({ game_id, name, status })),
    }),
  );
  if (candidates.length === 0)
    throw new Error(
      "No live Frontier game is listed for this shard. The launch Worker must create the calendar game before this check can play.",
    );
  if (candidates.length !== 1) throw new Error("Several live Frontier games are listed; select one with --game-id");
  const game = candidates[0]!;
  return { gameId: game.game_id, gameName: game.name, startAt: game.clock.start_main_at, settlementTransactions: 0 };
}
