import dev from "../../../contracts/common/addresses/dev.json";
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from "vitest";
import { RpcError, RpcProvider } from "starknet";
import { heldRealms, holdsRealm, RealmHoldingsUnavailableError } from "./realm-holdings";

const env = {
  ENVIRONMENT: "staging" as const,
  L2_RPC_URL: "https://starknet-mainnet.g.alchemy.com/v2/test",
  MARKETPLACE_API_URL: "https://market.test/api/marketplace",
};
const HOLDER = "0x456";
const OTHER = "0x999";
const INDEX = `https://market.test/api/marketplace/v1/chains/SN_MAIN`;

/** The marketplace indexer as it answers: `{data}` per route, a 404 for a token it never saw, or down. */
let indexer: {
  owners: Record<number, string>;
  holdings: Record<string, number[][]>;
  down: boolean;
  redirects?: boolean;
};
let chainOwner: string | Error;
let indexerReads: string[];
let chainReads: MockInstance<RpcProvider["callContract"]>;

beforeEach(() => {
  indexer = { owners: {}, holdings: {}, down: false };
  chainOwner = HOLDER;
  indexerReads = [];
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    // The Workers runtime refuses this option before anything is sent; Node accepts it, so the stub refuses it as the
    // runtime does.
    if (init?.redirect === "error")
      throw new TypeError(
        'Invalid redirect value, must be one of "follow" or "manual" ("error" won\'t be implemented)',
      );
    indexerReads.push(input);
    if (indexer.down) throw new TypeError("fetch failed");
    if (indexer.redirects) return new Response(null, { status: 302, headers: { location: "https://elsewhere.test/" } });
    return answerIndex(new URL(input));
  });
  vi.spyOn(RpcProvider.prototype, "getChainId").mockResolvedValue("0x534e5f4d41494e");
  chainReads = vi.spyOn(RpcProvider.prototype, "callContract").mockImplementation(async () => {
    if (chainOwner instanceof Error) throw chainOwner;
    return [chainOwner];
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const answerIndex = (url: URL) => {
  const token = url.pathname.match(/\/tokens\/0x[0-9a-f]+\/(\d+)$/);
  if (token) {
    const owner = indexer.owners[Number(token[1])];
    return owner
      ? Response.json({ data: { tokenId: token[1], owner } })
      : Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  const account = url.pathname.match(/\/accounts\/(0x[0-9a-f]+)\/holdings$/)!;
  const pages = indexer.holdings[account[1]!] ?? [[]];
  const page = Number(url.searchParams.get("cursor") ?? 0);
  return Response.json({
    data: {
      items: pages[page]!.map((id) => ({ tokenId: String(id), owner: account[1] })),
      nextCursor: page + 1 < pages.length ? String(page + 1) : null,
    },
  });
};

it("lets the holder settle on the chain's live owner, whether the index is up or down", async () => {
  indexer.owners[711] = HOLDER;
  expect(await holdsRealm(env, HOLDER, 711)).toBe(true);
  indexer.down = true;
  expect(await holdsRealm(env, HOLDER, 711)).toBe(true);
  expect(chainReads).toHaveBeenCalledTimes(2);
  expect(chainReads).toHaveBeenCalledWith(
    { contractAddress: dev.realms, entrypoint: "owner_of", calldata: ["711", "0"] },
    "latest",
  );
  expect(indexerReads).toEqual([]);
});

it("refuses the seller the index still names once the chain names the buyer, and lets the buyer settle", async () => {
  indexer.owners[711] = HOLDER;
  chainOwner = OTHER;
  expect(await holdsRealm(env, HOLDER, 711)).toBe(false);
  expect(await holdsRealm(env, OTHER, 711)).toBe(true);
});

it("refuses a Realm never minted on this chain", async () => {
  chainOwner = new RpcError(
    { code: 40, message: "Contract error" } as ConstructorParameters<typeof RpcError>[0],
    "starknet_call",
    {},
  );
  expect(await holdsRealm(env, HOLDER, 7999)).toBe(false);
});

it("asks for a retry instead of refusing when the chain does not answer", async () => {
  chainOwner = new Error("fetch failed");
  await expect(holdsRealm(env, HOLDER, 711)).rejects.toBeInstanceOf(RealmHoldingsUnavailableError);
});

it("lists every page of a wallet's Realms in order, and has no chain fallback for the list", async () => {
  indexer.holdings[HOLDER] = [[934, 3], [251]];
  expect(await heldRealms(env, HOLDER)).toEqual([3, 251, 934]);
  expect(await heldRealms(env, OTHER)).toEqual([]);
  indexer.down = true;
  await expect(heldRealms(env, HOLDER)).rejects.toBeInstanceOf(RealmHoldingsUnavailableError);
  expect(chainReads).not.toHaveBeenCalled();
});

it("says why the index could not be read, and follows no redirect", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  indexer.holdings[HOLDER] = [[711]];
  indexer.redirects = true;
  await expect(heldRealms(env, HOLDER)).rejects.toBeInstanceOf(RealmHoldingsUnavailableError);
  indexer.redirects = false;
  indexer.down = true;
  await expect(heldRealms(env, HOLDER)).rejects.toBeInstanceOf(RealmHoldingsUnavailableError);
  expect(logged.mock.calls).toEqual([
    ["realm_index_unavailable", { route: "accounts", status: 302 }],
    ["realm_index_unavailable", { route: "accounts", cause: "TypeError: fetch failed" }],
  ]);
  indexer.down = false;
  expect(await heldRealms(env, HOLDER)).toEqual([711]);
});
