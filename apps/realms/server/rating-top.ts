import { environmentL2 } from "@realms-world/chain";
import type { IdentityEnv } from "./env";
import { json } from "./http";
import { profilesOfRatingOwners } from "./profiles";
import { ratingFailure } from "./rating-failure";
import { ratingPoints } from "./rating-ledger";
import { ratingIdentifier } from "./ratings";

/**
 * Every rated wallet in rating order and the reader's own position, one snapshot: the whole board, which the reader
 * holds in full already, so a board shows every place. A reader before their first rated game has no rank.
 */
export async function handleRatingTop(env: Pick<IdentityEnv, "DB" | "RATING_READER" | "ENVIRONMENT">, url: URL) {
  const query = topQuery(url);
  if (query === undefined) return json({ error: "invalid_rating_query" }, 400);
  try {
    const reader = env.RATING_READER.get(env.RATING_READER.idFromName(environmentL2(env.ENVIRONMENT).chain));
    const snapshot = await reader.top();
    const self = await readerPosition(reader, snapshot, query);
    const profiles = await profilesOfRatingOwners(env.DB, [
      ...snapshot.entries.map(({ player }) => player),
      ...(self?.player ? [self.player] : []),
    ]);
    return json({
      ...snapshot,
      entries: snapshot.entries.map((entry) => ({ ...entry, profile: profiles.get(entry.player) ?? null })),
      self: self?.player ? { ...self, profile: profiles.get(self.player) ?? null } : self,
    });
  } catch (error) {
    console.error("rating_top_unavailable");
    return ratingFailure(error);
  }
}

async function readerPosition(
  reader: ReturnType<IdentityEnv["RATING_READER"]["get"]>,
  snapshot: Awaited<ReturnType<typeof reader.top>>,
  player: string | null,
) {
  if (!player) return null;
  const entry = snapshot.entries.find((row) => row.player === player);
  if (entry) return { status: "rated", player: player, rating: entry.rating, rank: entry.rank };
  const amount = (await reader.ratings([player], snapshot.block_hash)).values[0]?.[1];
  if (amount === undefined) throw new Error("Reader rating missing");
  return { status: "rated", player: player, rating: ratingPoints(BigInt(amount)), rank: null };
}

/** The reader whose position is asked for, null for none, or undefined for a query this route does not answer. */
function topQuery(url: URL): string | null | undefined {
  const players = url.searchParams.getAll("player");
  if (url.searchParams.has("realmsId") || players.length > 1) return undefined;
  const value = players[0];
  if (value === undefined) return null;
  return ratingIdentifier(value) ?? undefined;
}
