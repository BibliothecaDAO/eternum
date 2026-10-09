import type { IdentityEnv } from "./env";
import { json } from "./http";
import { profilesOfRatingOwners } from "./profiles";
import { ratingFailure } from "./rating-failure";
import { ratingPoints } from "./rating-ledger";
import { ratingIdentifier, resolveRatingIdentities, type RatingIdentity } from "./ratings";

interface TopQuery {
  limit: number;
  reader: { kind: "players" | "realmsIds"; identifier: string } | null;
}

/** The list and the reader's own position are one snapshot, including readers outside the visible top. */
export async function handleRatingTop(env: Pick<IdentityEnv, "DB" | "RATING_READER">, url: URL) {
  const query = topQuery(url);
  if (!query) return json({ error: "invalid_rating_query" }, 400);
  try {
    const identity = await readerIdentity(env.DB, query.reader);
    const reader = env.RATING_READER.get(env.RATING_READER.idFromName("mainnet"));
    const snapshot = await reader.top();
    const self = await readerPosition(reader, snapshot, identity);
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
  identity: RatingIdentity | null,
) {
  if (!identity) return null;
  if (identity.player === null) return { ...identity, rank: null };
  const entry = snapshot.entries.find((row) => row.player === identity.player);
  if (entry) return { status: "rated", player: identity.player, rating: entry.rating, rank: entry.rank };
  const amount = (await reader.ratings([identity.player], snapshot.block_hash)).values[0]?.[1];
  if (amount === undefined) throw new Error("Cached reader rating missing");
  return { status: "rated", player: identity.player, rating: ratingPoints(BigInt(amount)), rank: null };
}

async function readerIdentity(db: D1Database, reader: TopQuery["reader"]): Promise<RatingIdentity | null> {
  if (!reader) return null;
  const identities = await resolveRatingIdentities(db, { kind: reader.kind, requested: [reader.identifier] });
  const identity = identities.values().next().value;
  if (!identity) throw new Error("Reader identity missing");
  return identity;
}

function topQuery(url: URL): TopQuery | null {
  const limits = url.searchParams.getAll("limit");
  const players = url.searchParams.getAll("player");
  const realms = url.searchParams.getAll("realmsId");
  const limit = limits.length ? Number(limits[0]) : 20;
  if (limits.length > 1 || !Number.isInteger(limit) || limit < 1 || limit > 100 || players.length + realms.length > 1)
    return null;
  const value = players[0] ?? realms[0];
  const kind = players.length ? "players" : "realmsIds";
  if (value !== undefined && ratingIdentifier(value, kind) === null) return null;
  return { limit, reader: value === undefined ? null : { kind, identifier: value } };
}
