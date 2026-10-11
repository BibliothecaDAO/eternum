import { environmentL2 } from "@realms-world/chain";
import { normalizeStarknetAddress as canonical } from "@realms-world/identity";
import type { IdentityEnv } from "./env";
import { json } from "./http";
import { ratingFailure } from "./rating-failure";
import { ratingPoints } from "./rating-ledger";

const BATCH_LIMIT = 100;
const FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const ADDRESS_BOUND = (1n << 251n) - 256n;

/** Ratings belong to the wallet that played; changing an identity link cannot retarget a game's rating. */
export async function handleRatings(
  env: Pick<IdentityEnv, "RATING_READER" | "ENVIRONMENT">,
  url: URL,
): Promise<Response> {
  const query = parseRatingQuery(url);
  if (!query) return json({ error: "invalid_rating_query" }, 400);
  try {
    const owners = [...new Set(query.requested.map(canonical))];
    const result = await env.RATING_READER.get(
      env.RATING_READER.idFromName(environmentL2(env.ENVIRONMENT).chain),
    ).ratings(owners, query.blockHash);
    return json({
      block_number: result.block_number,
      block_hash: result.block_hash,
      ratings: ratingsByWallet(query.requested, result.values),
    });
  } catch (error) {
    console.error("ratings_read_unavailable");
    return ratingFailure(error);
  }
}

function ratingsByWallet(requested: string[], rows: string[][]) {
  const values = new Map(
    rows.map(([owner, value]) => {
      if (!owner || value === undefined) throw new Error("Invalid ledger rating");
      return [owner, value] as const;
    }),
  );
  return Object.fromEntries(
    requested.map((identifier) => {
      const player = canonical(identifier);
      const value = values.get(player);
      if (value === undefined) throw new Error("Ledger rating missing");
      return [identifier, { status: "rated", player, rating: ratingPoints(BigInt(value)) }];
    }),
  );
}

function parseRatingQuery(url: URL) {
  const players = url.searchParams.getAll("players");
  if (players.length !== 1 || url.searchParams.has("realmsIds") || url.searchParams.has("accounts")) return null;
  const requested = players[0]!.split(",");
  if (requested.length > BATCH_LIMIT || !requested.every((id) => ratingIdentifier(id) !== null)) return null;
  const hashes = url.searchParams.getAll("block_hash");
  if (hashes.length > 1 || (hashes[0] !== undefined && !validIdentifier(hashes[0], FIELD_PRIME))) return null;
  return { requested, ...(hashes[0] ? { blockHash: hashes[0] } : {}) };
}
const validIdentifier = (value: string, bound: bigint) =>
  /^0x[0-9a-fA-F]{1,64}$/.test(value) && BigInt(value) > 0n && BigInt(value) < bound;
export const ratingIdentifier = (value: string): string | null =>
  validIdentifier(value, ADDRESS_BOUND) ? canonical(value) : null;
