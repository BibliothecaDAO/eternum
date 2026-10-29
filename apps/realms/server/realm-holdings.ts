import { environmentL2, valuePlaneAddress } from "@realms-world/chain";
import { RpcError } from "starknet";
import { identityProvider, verifyIdentityChain } from "./l2";

/**
 * The one reader of Realm NFT holdings. Whether a wallet holds a Realm, which grants it, is the chain's live `owner_of`
 * only: an index that has not seen a sale would credit the seller. The marketplace index lists a wallet's Realms for the
 * picker, where a stale entry costs nothing because the grant is checked again.
 */
interface HoldingsEnvironment {
  ENVIRONMENT: import("@realms-world/chain").ValueEnvironment;
  L2_RPC_URL: string;
  /** The marketplace API's base, up to (not including) `/v1`. */
  MARKETPLACE_API_URL: string;
}

/** A holdings answer could not be had from either source; the player can retry. */
export class RealmHoldingsUnavailableError extends Error {
  constructor() {
    super("realm_holdings_unavailable");
  }
}

const INDEXER_TIMEOUT_MS = 3_000;
/** 8,000 Realms at the indexer's 100 a page. */
const MAX_HOLDING_PAGES = 80;

/** Whether `wallet` holds Realm `realmId` now, by the chain's live owner; a retry error when the chain cannot answer. */
export async function holdsRealm(env: HoldingsEnvironment, wallet: string, realmId: number): Promise<boolean> {
  try {
    return sameAddress(await liveRealmOwner(env, realmId), wallet);
  } catch (error) {
    if (isMissingToken(error)) return false;
    throw new RealmHoldingsUnavailableError();
  }
}

/** Every Realm the indexer has `wallet` holding, ascending. The chain cannot list them, so there is no fallback. */
export async function heldRealms(env: HoldingsEnvironment, wallet: string): Promise<number[]> {
  const realms: number[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_HOLDING_PAGES; page += 1) {
    const holdings: HoldingsPage | null = await readIndexer<HoldingsPage>(env, holdingsPath(env, wallet, cursor));
    if (!holdings) throw new RealmHoldingsUnavailableError();
    realms.push(
      ...holdings.items.filter((token) => sameAddress(token.owner, wallet)).map((token) => Number(token.tokenId)),
    );
    cursor = holdings.nextCursor;
    if (!cursor) return realms.sort((a, b) => a - b);
  }
  throw new RealmHoldingsUnavailableError();
}

interface IndexedToken {
  tokenId: string;
  owner: string;
}
interface HoldingsPage {
  items: IndexedToken[];
  nextCursor: string | null;
}

const holdingsPath = (env: HoldingsEnvironment, wallet: string, cursor: string | null) => {
  const query = new URLSearchParams({ collection: realmsCollection(env), limit: "100" });
  if (cursor) query.set("cursor", cursor);
  return `accounts/${wallet}/holdings?${query}`;
};

/**
 * One indexer read with a short timeout; a failure is logged with its cause and is null, so the caller decides what to
 * fall back to. A redirect is not followed: it answers 3xx and fails like any other non-2xx, since the Workers runtime
 * has no "error" redirect mode (scripts/check-worker-fetch-options.mjs).
 */
async function readIndexer<T>(env: HoldingsEnvironment, path: string): Promise<T | null> {
  const { chain } = environmentL2(env.ENVIRONMENT);
  const route = path.split("/")[0];
  try {
    const response = await fetch(`${env.MARKETPLACE_API_URL}/v1/chains/${chain}/${path}`, {
      signal: AbortSignal.timeout(INDEXER_TIMEOUT_MS),
      redirect: "manual",
    });
    if (!response.ok) {
      console.error("realm_index_unavailable", { route, status: response.status });
      return null;
    }
    const data = ((await response.json()) as { data?: T }).data ?? null;
    if (data === null) console.error("realm_index_unavailable", { route, status: response.status, cause: "no data" });
    return data;
  } catch (error) {
    console.error("realm_index_unavailable", { route, cause: String(error) });
    return null;
  }
}

/** The Realm's owner read live on the environment chain. */
async function liveRealmOwner(env: HoldingsEnvironment, realmId: number): Promise<string> {
  const id = BigInt(realmId);
  const provider = identityProvider(env);
  await verifyIdentityChain(provider, env);
  const owner = await provider.callContract(
    {
      contractAddress: realmsCollection(env),
      entrypoint: "owner_of",
      calldata: [String(id & (2n ** 128n - 1n)), String(id >> 128n)],
    },
    "latest",
  );
  if (owner.length !== 1 || BigInt(owner[0]!) <= 0n || BigInt(owner[0]!) >= (1n << 251n) - 256n)
    throw new Error("invalid_realm_owner");
  return owner[0]!;
}

const realmsCollection = (env: HoldingsEnvironment) => valuePlaneAddress("realms", env.ENVIRONMENT);

/** A Realm never minted on this chain reverts `owner_of`: no one holds it. */
const isMissingToken = (error: unknown) => error instanceof RpcError && error.isType("CONTRACT_ERROR");

const sameAddress = (a: string, b: string) => BigInt(a) === BigInt(b);
