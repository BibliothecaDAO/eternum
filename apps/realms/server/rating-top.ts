import { hash } from "starknet";
import type { IdentityEnv } from "./env";
import { json } from "./http";
import { openRatingLedger, readLedgerRatings, ratingPoints, type RatingLedger } from "./rating-ledger";
import { ratingIdentifier, resolveRatingIdentities, type RatingIdentity } from "./ratings";

const MMR_UPDATED = hash.getSelectorFromName("MMRUpdated");
interface TopQuery {
  limit: number;
  reader: { kind: "players" | "realmsIds"; identifier: string } | null;
}

/** The list and the reader's own position are one snapshot, including readers outside the visible top. */
export async function handleRatingTop(env: Pick<IdentityEnv, "DB" | "IDENTITY_RPC_URL">, url: URL) {
  const query = topQuery(url);
  if (!query) return json({ error: "invalid_rating_query" }, 400);
  try {
    const [identity, ledger] = await Promise.all([
      readerIdentity(env.DB, query.reader),
      openRatingLedger(env.IDENTITY_RPC_URL),
    ]);
    const population = await ratingPopulation(ledger);
    const owners = new Set(population);
    if (identity?.player) owners.add(identity.player);
    const values = await readLedgerRatings(ledger, [...owners]);
    const response = topResponse(ledger, population, values, query.limit, identity);
    ledger.signal.throwIfAborted();
    return json(response);
  } catch {
    console.error("rating_top_unavailable");
    return json({ error: "ratings_unavailable" }, 503);
  }
}

async function readerIdentity(db: D1Database, reader: TopQuery["reader"]): Promise<RatingIdentity | null> {
  if (!reader) return null;
  const identities = await resolveRatingIdentities(db, { kind: reader.kind, requested: [reader.identifier] });
  const identity = identities.values().next().value;
  if (!identity) throw new Error("Reader identity missing");
  return identity;
}

function topResponse(
  ledger: RatingLedger,
  population: Set<string>,
  values: Map<string, bigint>,
  limit: number,
  identity: RatingIdentity | null,
) {
  const entries = rankRatings(population, values);
  return {
    block_number: ledger.block,
    block_hash: ledger.blockHash,
    total: population.size,
    entries: entries.slice(0, limit),
    self: readerPosition(identity, entries, values),
  };
}

function readerPosition(
  identity: RatingIdentity | null,
  entries: ReturnType<typeof rankRatings>,
  values: Map<string, bigint>,
) {
  if (!identity) return null;
  if (identity.player === null) return { ...identity, rank: null };
  return {
    status: "rated",
    player: identity.player,
    rating: ratingPoints(requiredRating(values, identity.player)),
    rank: entries.find((entry) => entry.player === identity.player)?.rank ?? null,
  };
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

async function ratingPopulation(ledger: RatingLedger) {
  const owners = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    ledger.signal.throwIfAborted();
    const page = await ledger.provider.getEvents({
      address: ledger.token,
      keys: [[MMR_UPDATED]],
      from_block: { block_number: 0 },
      to_block: { block_hash: ledger.blockHash },
      chunk_size: 1000,
      ...(cursor ? { continuation_token: cursor } : {}),
    });
    for (const event of page.events) {
      const owner = event.keys[1] ? ratingIdentifier(event.keys[1], "players") : null;
      if (!owner || !event.keys[0] || BigInt(event.keys[0]) !== BigInt(MMR_UPDATED))
        throw new Error("Invalid MMR history owner");
      owners.add(owner);
    }
    cursor = page.continuation_token || undefined;
    if (cursor && cursors.has(cursor)) throw new Error("MMR history cursor repeated");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  ledger.signal.throwIfAborted();
  return owners;
}

function rankRatings(population: Set<string>, values: Map<string, bigint>) {
  const ordered = [...population].sort((a, b) => {
    const left = requiredRating(values, a),
      right = requiredRating(values, b);
    return left === right ? (BigInt(a) < BigInt(b) ? -1 : 1) : left > right ? -1 : 1;
  });
  let rank = 0;
  return ordered.map((player, index) => {
    const value = requiredRating(values, player);
    if (index === 0 || value !== requiredRating(values, ordered[index - 1]!)) rank = index + 1;
    return { rank, player, rating: ratingPoints(value) };
  });
}

function requiredRating(values: Map<string, bigint>, player: string) {
  const value = values.get(player);
  if (value === undefined) throw new Error("Population rating missing");
  return value;
}
