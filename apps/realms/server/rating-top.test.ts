import { RpcProvider } from "starknet";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { testRatingReader } from "./rating-test-reader";
import { routeIdentityRequest } from "./routes";
import type { IdentityEnv } from "./env";
import type { IdentityAuth } from "./auth";

const block = { block_number: 77, block_hash: "0xabc" } as Awaited<ReturnType<RpcProvider["getBlock"]>>;
let identityRows: { realmsId: string; address: string | null }[] = [];
let cache: ReturnType<typeof testRatingReader>;
let population = { ...block, players: ["0xa", "0xb", "0xc", "0xd"] };
const env = {
  IDENTITY_RPC_URL: "https://mainnet.test/rpc",
  PUBLIC_RATE_LIMIT: { limit: vi.fn(async () => ({ success: true })) },
  DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: identityRows }) }) }) },
} as unknown as IdentityEnv;
const request = (query = "") =>
  routeIdentityRequest(
    new Request(`https://play.test/api/ratings/top?${query}`),
    env,
    {} as IdentityAuth,
    {} as Parameters<typeof routeIdentityRequest>[3],
  );
beforeEach(() => {
  cache = testRatingReader();
  env.RATING_READER = cache.binding as unknown as IdentityEnv["RATING_READER"];
  population = { ...block, players: ["0xa", "0xb", "0xc", "0xd"] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) =>
      init?.method === "HEAD"
        ? new Response(null, {
            headers: { "x-rating-hash": population.block_hash!, "x-rating-block": String(population.block_number) },
          })
        : Response.json(population),
    ),
  );
  identityRows = [{ realmsId: "0x1", address: "0xd" }];
  vi.spyOn(RpcProvider.prototype, "getChainId").mockResolvedValue("0x534e5f4d41494e");
  vi.spyOn(RpcProvider.prototype, "getBlock").mockResolvedValue(block);
  vi.spyOn(RpcProvider.prototype, "callContract").mockImplementation(async ({ calldata }) => {
    const player = Array.isArray(calldata) ? String(calldata[0]) : "";
    const points = player === "0xa" || player === "0xb" ? 2000n : player === "0xc" ? 1600n : 1000n;
    return [`0x${(points * 10n ** 18n).toString(16)}`, "0x0"];
  });
});
afterEach(() => {
  cache.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("serves tied top positions and the reader below the top from one block and value map", async () => {
  const response = await request("limit=2&realmsId=0x1");
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    block_number: 77,
    block_hash: "0xabc",
    total: 4,
    entries: [
      { rank: 1, player: "0xa", rating: "2000" },
      { rank: 1, player: "0xb", rating: "2000" },
    ],
    self: { status: "rated", player: "0xd", rating: "1000", rank: 4 },
  });
  expect(RpcProvider.prototype.callContract).toHaveBeenCalledTimes(4);
  for (const args of vi.mocked(RpcProvider.prototype.callContract).mock.calls) expect(args[1]).toBe("0xabc");
  expect(fetch).toHaveBeenCalledWith(
    "https://realms.world/api/ratings/population",
    expect.objectContaining({ method: "HEAD" }),
  );
});

it("uses the same current rating read for a ranked reader and a never-ranked initial wallet", async () => {
  const ranked = await request("player=0xc");
  expect(await ranked.json()).toMatchObject({
    entries: [{ rank: 1 }, { rank: 1 }, { rank: 3 }, { rank: 4 }],
    self: { rank: 3, rating: "1600" },
  });
  population = { ...block, block_number: 78, block_hash: "0xdef", players: [] };
  vi.mocked(RpcProvider.prototype.getBlock).mockResolvedValue(
    population as Awaited<ReturnType<RpcProvider["getBlock"]>>,
  );
  const unrated = await request("player=0xe");
  expect(await unrated.json()).toMatchObject({
    total: 0,
    entries: [],
    self: { status: "rated", rating: "1000", rank: null },
  });
});

it.each(["limit=0", "limit=101", "limit=x", "player=0x0", "player=0xa&realmsId=0x1", "realmsId=broken"])(
  "rejects invalid top queries: %s",
  async (query) => {
    expect((await request(query)).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  },
);

it("never supplies a partial ranking when history or a rating read fails", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
  expect((await request()).status).toBe(503);
  vi.mocked(RpcProvider.prototype.callContract).mockRejectedValue(new Error("rating unavailable"));
  expect((await request()).status).toBe(503);
});

it("refuses a SQL watermark inconsistent with the chain instead of returning a truncated list", async () => {
  population = { ...block, block_number: 78, players: ["0xa"] };
  expect((await request()).status).toBe(503);
});

it("preserves explicit unlinked and unknown identities in the own-rank slot", async () => {
  population = { ...block, players: [] };
  identityRows = [{ realmsId: "0x1", address: null }];
  expect(await (await request("realmsId=0x1")).json()).toMatchObject({
    self: { status: "unlinked", player: null, rating: null, rank: null },
  });
  expect(await (await request("realmsId=0x2")).json()).toMatchObject({
    self: { status: "unknown_identity", player: null, rating: null, rank: null },
  });
});

it("does not publish a partial list after the shared read deadline expires", async () => {
  const controller = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  vi.mocked(fetch).mockImplementation(async () => {
    controller.abort();
    throw new Error("History deadline expired");
  });
  expect((await request()).status).toBe(503);
  expect(RpcProvider.prototype.callContract).not.toHaveBeenCalled();
});
