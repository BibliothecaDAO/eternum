import type { IdentityEnv } from "./env";
import { json } from "./http";
import { ratingFailure } from "./rating-failure";
import { ratingPoints } from "./rating-ledger";

const BATCH_LIMIT = 100;
const FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const ADDRESS_BOUND = (1n << 251n) - 256n;
type Unrated = { status: "unlinked" | "unknown_identity"; player: null; rating: null };
type Rating = { status: "rated"; player: string; rating: string } | Unrated;
export type RatingIdentity = { player: string } | Unrated;
interface RatingQuery {
  kind: "realmsIds" | "players";
  requested: string[];
  blockHash?: string;
}
interface LedgerRatings {
  block: number | null;
  ratings: Map<string, bigint>;
}

/** One current rating read for lobby, season, profile and results; immutable MMR events are never a fallback. */
export async function handleRatings(env: Pick<IdentityEnv, "DB" | "RATING_READER">, url: URL): Promise<Response> {
  const query = parseRatingQuery(url);
  if (!query) return json({ error: "invalid_rating_query" }, 400);
  try {
    const players = await resolveRatingIdentities(env.DB, query);
    const owners = [...new Set([...players.values()].flatMap(({ player }) => (player === null ? [] : [player])))];
    const result = owners.length
      ? await env.RATING_READER.get(env.RATING_READER.idFromName("mainnet")).ratings(owners, query.blockHash)
      : null;
    return json({
      block_number: result?.block_number ?? null,
      block_hash: result?.block_hash ?? null,
      ratings: ratingsByIdentifier(query, players, {
        block: result?.block_number ?? null,
        ratings: new Map(
          result?.values.map((entry) => {
            const owner = entry[0],
              value = entry[1];
            if (!owner || value === undefined) throw new Error("Invalid cached rating");
            return [owner, BigInt(value)] as const;
          }) ?? [],
        ),
      }),
    });
  } catch (error) {
    // No stale history or application initial rating can hide a failed live read.
    console.error("ratings_read_unavailable");
    return ratingFailure(error);
  }
}

function ratingsByIdentifier(query: RatingQuery, players: Map<string, RatingIdentity>, ledger: LedgerRatings) {
  const ratings: Record<string, Rating> = {};
  for (const identifier of query.requested) {
    const identity = players.get(canonical(identifier));
    if (!identity) throw new Error("Rating identity missing");
    if (identity.player === null) ratings[identifier] = identity;
    else {
      const rating = ledger.ratings.get(identity.player);
      if (rating === undefined) throw new Error("Ledger rating missing");
      ratings[identifier] = { status: "rated", player: identity.player, rating: ratingPoints(rating) };
    }
  }
  return ratings;
}

function parseRatingQuery(url: URL): RatingQuery | null {
  const realmParams = url.searchParams.getAll("realmsIds");
  const playerParams = url.searchParams.getAll("players");
  if (realmParams.length + playerParams.length !== 1) return null;
  const kind = realmParams.length ? "realmsIds" : "players";
  const requested = (realmParams[0] ?? playerParams[0] ?? "").split(",");
  if (requested.length > BATCH_LIMIT || !requested.every((id) => ratingIdentifier(id, kind) !== null)) return null;
  const hashes = url.searchParams.getAll("block_hash");
  if (hashes.length > 1 || (hashes[0] !== undefined && !validIdentifier(hashes[0], FIELD_PRIME))) return null;
  return { kind, requested, ...(hashes[0] ? { blockHash: hashes[0] } : {}) };
}

export async function resolveRatingIdentities(
  db: D1Database,
  query: RatingQuery,
): Promise<Map<string, RatingIdentity>> {
  const identifiers = [...new Set(query.requested.map(canonical))];
  if (query.kind === "players") return new Map(identifiers.map((player) => [player, { player }]));
  const { results } = await db
    .prepare(`SELECT "realmsId", "address" FROM "user" WHERE "realmsId" IN (${identifiers.map(() => "?").join(", ")})`)
    .bind(...identifiers)
    .all<{ realmsId: string; address: string | null }>();
  const wallets = new Map(results.map((row) => [row.realmsId, row.address]));
  return new Map(
    identifiers.map((id): [string, RatingIdentity] => {
      if (!wallets.has(id)) return [id, { status: "unknown_identity", player: null, rating: null }];
      const address = wallets.get(id);
      if (address === null) return [id, { status: "unlinked", player: null, rating: null }];
      if (address === undefined || !validIdentifier(address, ADDRESS_BOUND))
        throw new Error("Invalid linked rating owner");
      return [id, { player: canonical(address) }];
    }),
  );
}

const validIdentifier = (value: string, bound: bigint) =>
  /^0x[0-9a-fA-F]{1,64}$/.test(value) && BigInt(value) > 0n && BigInt(value) < bound;
const canonical = (value: string) => `0x${BigInt(value).toString(16)}`;

export const ratingIdentifier = (value: string, kind: RatingQuery["kind"]): string | null =>
  validIdentifier(value, kind === "players" ? ADDRESS_BOUND : FIELD_PRIME) ? canonical(value) : null;
