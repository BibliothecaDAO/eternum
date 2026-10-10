import { environmentL2 } from "@realms-world/chain";
import type { IdentityEnv } from "./env";
import { json } from "./http";
import { profilesOfRatingOwners } from "./profiles";
import { ratingFailure } from "./rating-failure";
import { ratingPoints } from "./rating-ledger";
import { ratingIdentifier } from "./ratings";

interface TopQuery {
  limit: number;
  reader: string | null;
}

/** The list and the reader's own position are one snapshot, including readers outside the visible top. */
export async function handleRatingTop(env: Pick<IdentityEnv, "DB" | "RATING_READER" | "ENVIRONMENT">, url: URL) {
  const query = topQuery(url);
  if (!query) return json({ error: "invalid_rating_query" }, 400);
  try {
    const reader = env.RATING_READER.get(env.RATING_READER.idFromName(environmentL2(env.ENVIRONMENT).chain));
    const snapshot = await reader.top();
    const self = await readerPosition(reader, snapshot, query.reader);
    const entries = snapshot.entries.slice(0, query.limit);
    const profiles = await profilesOfRatingOwners(env.DB, [
      ...entries.map(({ player }) => player),
      ...(self?.player ? [self.player] : []),
    ]);
    return json({
      ...snapshot,
      total: snapshot.entries.length,
      entries: entries.map((entry) => ({ ...entry, profile: profiles.get(entry.player) ?? null })),
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

function topQuery(url: URL): TopQuery | null {
  const limits = url.searchParams.getAll("limit");
  const players = url.searchParams.getAll("player");
  if (url.searchParams.has("realmsId")) return null;
  const limit = limits.length ? Number(limits[0]) : 20;
  if (limits.length > 1 || !Number.isInteger(limit) || limit < 1 || limit > 100 || players.length > 1) return null;
  const value = players[0];
  const reader = value === undefined ? null : ratingIdentifier(value);
  if (value !== undefined && reader === null) return null;
  return { limit, reader };
}
