import { assertProviderChain, valuePlaneAddress } from "@realms-world/chain";
import { RpcProvider } from "starknet";
import type { IdentityEnv } from "./env";
import { json } from "./http";

const BATCH_LIMIT = 100;
const CONCURRENT_READS = 8;
const FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const ADDRESS_BOUND = (1n << 251n) - 256n;
const PRECISION = 10n ** 18n;
type Unrated = { status: "unlinked" | "unknown_identity"; player: null; rating: null };
type Rating = { status: "rated"; player: string; rating: string } | Unrated;
type Player = { player: string } | Unrated;
interface RatingQuery {
  kind: "realmsIds" | "players";
  requested: string[];
}
interface LedgerRatings {
  block: number | null;
  ratings: Map<string, string>;
}

/** One current rating read for lobby, season, profile and results; immutable MMR events are never a fallback. */
export async function handleRatings(env: Pick<IdentityEnv, "DB" | "IDENTITY_RPC_URL">, url: URL): Promise<Response> {
  const query = parseRatingQuery(url);
  if (!query) return json({ error: "invalid_rating_query" }, 400);
  try {
    const players = await resolvePlayers(env.DB, query);
    const owners = [...new Set([...players.values()].flatMap(({ player }) => (player === null ? [] : [player])))];
    const ledger = owners.length
      ? await readLedgerRatings(env.IDENTITY_RPC_URL, owners)
      : { block: null, ratings: new Map<string, string>() };
    return json({ block_number: ledger.block, ratings: ratingsByIdentifier(query, players, ledger) });
  } catch {
    // No stale history or application initial rating can hide a failed live read.
    console.error("ratings_read_unavailable");
    return json({ error: "ratings_unavailable" }, 503);
  }
}

function ratingsByIdentifier(query: RatingQuery, players: Map<string, Player>, ledger: LedgerRatings) {
  const ratings: Record<string, Rating> = {};
  for (const identifier of query.requested) {
    const identity = players.get(canonical(identifier));
    if (!identity) throw new Error("Rating identity missing");
    if (identity.player === null) ratings[identifier] = identity;
    else {
      const rating = ledger.ratings.get(identity.player);
      if (rating === undefined) throw new Error("Ledger rating missing");
      ratings[identifier] = { status: "rated", player: identity.player, rating };
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
  const bound = kind === "players" ? ADDRESS_BOUND : FIELD_PRIME;
  if (requested.length > BATCH_LIMIT || !requested.every((id) => validIdentifier(id, bound))) return null;
  return { kind, requested };
}

async function resolvePlayers(db: D1Database, query: RatingQuery): Promise<Map<string, Player>> {
  const identifiers = [...new Set(query.requested.map(canonical))];
  if (query.kind === "players") return new Map(identifiers.map((player) => [player, { player }]));
  const { results } = await db
    .prepare(`SELECT "realmsId", "address" FROM "user" WHERE "realmsId" IN (${identifiers.map(() => "?").join(", ")})`)
    .bind(...identifiers)
    .all<{ realmsId: string; address: string | null }>();
  const wallets = new Map(results.map((row) => [row.realmsId, row.address]));
  return new Map(
    identifiers.map((id): [string, Player] => {
      if (!wallets.has(id)) return [id, { status: "unknown_identity", player: null, rating: null }];
      const address = wallets.get(id);
      if (address === null) return [id, { status: "unlinked", player: null, rating: null }];
      if (address === undefined || !validIdentifier(address, ADDRESS_BOUND))
        throw new Error("Invalid linked rating owner");
      return [id, { player: canonical(address) }];
    }),
  );
}

async function readLedgerRatings(rpcUrl: string, owners: string[]) {
  const provider = new RpcProvider({
    nodeUrl: rpcUrl,
    baseFetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(5_000) }),
  });
  await assertProviderChain(provider, "mainnet", "identity ratings");
  const token = valuePlaneAddress("mmrToken");
  const block = await provider.getBlockNumber();
  if (!Number.isSafeInteger(block) || block < 0) throw new Error("Invalid confirmed rating block");
  const ratings = new Map<string, string>();
  // Pin every owner to the same confirmed block, with bounded RPC concurrency and no persistent rating cache.
  for (let offset = 0; offset < owners.length; offset += CONCURRENT_READS) {
    await Promise.all(
      owners.slice(offset, offset + CONCURRENT_READS).map(async (player) => {
        const result = await provider.callContract(
          { contractAddress: token, entrypoint: "get_player_mmr", calldata: [player] },
          block,
        );
        ratings.set(player, ratingPoints(result));
      }),
    );
  }
  return { block, ratings };
}

function ratingPoints(result: string[]): string {
  if (result.length !== 2 || !result.every((limb) => /^0x[0-9a-fA-F]{1,32}$/.test(limb)))
    throw new Error("Invalid MMR u256");
  const raw = BigInt(result[0]!) + (BigInt(result[1]!) << 128n);
  if (raw === 0n) throw new Error("Effective MMR must be nonzero");
  const fraction = (raw % PRECISION).toString().padStart(18, "0").replace(/0+$/, "");
  return `${raw / PRECISION}${fraction ? `.${fraction}` : ""}`;
}

const validIdentifier = (value: string, bound: bigint) =>
  /^0x[0-9a-fA-F]{1,64}$/.test(value) && BigInt(value) > 0n && BigInt(value) < bound;
const canonical = (value: string) => `0x${BigInt(value).toString(16)}`;
