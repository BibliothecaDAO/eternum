import { RpcProvider } from "starknet";
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from "vitest";
import type { IdentityAuth } from "./auth";
import type { IdentityEnv } from "./env";
import { testRatingReader } from "./rating-test-reader";
import { routeIdentityRequest } from "./routes";

const query = vi.fn();
const env = {
  IDENTITY_RPC_URL: "https://mainnet.test/rpc",
  PUBLIC_RATE_LIMIT: { limit: vi.fn(async () => ({ success: true })) },
  DB: { prepare: () => ({ bind: (...ids: string[]) => ({ all: () => query(ids) }) }) },
} as unknown as IdentityEnv;
const request = (parameters: string) =>
  routeIdentityRequest(
    new Request(`https://play.test/api/ratings?${parameters}`),
    env,
    {} as IdentityAuth,
    {} as Parameters<typeof routeIdentityRequest>[3],
  );
let cache: ReturnType<typeof testRatingReader>;
let call: MockInstance<RpcProvider["callContract"]>;
beforeEach(() => {
  cache = testRatingReader();
  env.RATING_READER = cache.binding as unknown as IdentityEnv["RATING_READER"];
  query.mockClear();
  vi.spyOn(RpcProvider.prototype, "getChainId").mockResolvedValue("0x534e5f4d41494e");
  vi.spyOn(RpcProvider.prototype, "getBlock").mockResolvedValue({ block_number: 77, block_hash: "0xabc" } as Awaited<
    ReturnType<RpcProvider["getBlock"]>
  >);
  call = vi
    .spyOn(RpcProvider.prototype, "callContract")
    .mockResolvedValue([`0x${(1000n * 10n ** 18n).toString(16)}`, "0x0"]);
  query.mockResolvedValue({
    results: [
      { realmsId: "0x1", address: "0xa" },
      { realmsId: "0x2", address: null },
    ],
  });
  vi.mocked(env.PUBLIC_RATE_LIMIT.limit).mockResolvedValue({ success: true });
});
afterEach(() => {
  cache.close();
  vi.restoreAllMocks();
});

it("reads a linked identity's ledger owner, distinguishing unlinked and unknown identities without defaults", async () => {
  const response = await request("realmsIds=0x01,0x2,0x3");
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    block_number: 77,
    block_hash: "0xabc",
    ratings: {
      "0x01": { status: "rated", player: "0xa", rating: "1000" },
      "0x2": { status: "unlinked", player: null, rating: null },
      "0x3": { status: "unknown_identity", player: null, rating: null },
    },
  });
  expect(query).toHaveBeenCalledWith(["0x1", "0x2", "0x3"]);
  expect(call).toHaveBeenCalledWith(
    expect.objectContaining({ entrypoint: "get_player_mmr", calldata: ["0xa"] }),
    "0xabc",
  );
});

it("serves direct L2 owners through the same read, deduplicates, and preserves decimal/u256 precision", async () => {
  const value = (1n << 128n) + 1250000000000000000n;
  call.mockResolvedValue([`0x${(value % (1n << 128n)).toString(16)}`, "0x1"]);
  const response = await request("players=0x0a,0xa");
  expect(await response.json()).toEqual({
    block_number: 77,
    block_hash: "0xabc",
    ratings: {
      "0x0a": { status: "rated", player: "0xa", rating: "340282366920938463464.624607431768211456" },
      "0xa": { status: "rated", player: "0xa", rating: "340282366920938463464.624607431768211456" },
    },
  });
  expect(call).toHaveBeenCalledTimes(1);
});

it.each([
  "",
  "players=",
  "players=0xa&realmsIds=0x1",
  "players=0",
  "accounts=0x1&realmsIds=0x1",
  "accounts=0x0",
  "accounts=0x1&accounts=0x2",
  "players=0x0",
  "players=0xa,,0xb",
  `players=0x${(1n << 252n).toString(16)}`,
  `players=${Array(101).fill("0xa").join(",")}`,
])("rejects invalid queries before making a ledger call: %s", async (parameters) => {
  const response = await request(parameters);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid_rating_query" });
  expect(call).not.toHaveBeenCalled();
});

it("does not ask the chain for identities without linked wallets", async () => {
  const response = await request("realmsIds=0x2,0x3");
  expect(await response.json()).toEqual({
    block_number: null,
    block_hash: null,
    ratings: {
      "0x2": { status: "unlinked", player: null, rating: null },
      "0x3": { status: "unknown_identity", player: null, rating: null },
    },
  });
  expect(RpcProvider.prototype.getChainId).not.toHaveBeenCalled();
});

it("deduplicates a shared linked owner and never returns a partial batch or a DB fallback", async () => {
  query.mockResolvedValue({
    results: [
      { realmsId: "0x1", address: "0xa" },
      { realmsId: "0x2", address: "0x0a" },
    ],
  });
  expect((await request("realmsIds=0x1,0x2")).status).toBe(200);
  expect(call).toHaveBeenCalledTimes(1);
  call.mockImplementation(async ({ calldata }) => {
    if (Array.isArray(calldata) && calldata[0] === "0xb") throw new Error("one owner read failed");
    return [`0x${(1000n * 10n ** 18n).toString(16)}`, "0x0"];
  });
  const partial = await request("players=0xa,0xb");
  expect(partial.status).toBe(503);
  expect(await partial.json()).toEqual({ error: "ratings_unavailable" });
  query.mockRejectedValue(new Error("DB unavailable"));
  expect((await request("realmsIds=0x1")).status).toBe(503);
});

it("fails the whole batch on an outage, malformed result, wrong network or corrupt wallet mapping", async () => {
  for (const result of [[], ["0x1"], ["0x0", "0x0"], ["invalid", "0x0"], [`0x${(1n << 128n).toString(16)}`, "0x0"]]) {
    call.mockResolvedValue(result);
    expect((await request("players=0xa")).status).toBe(503);
  }
  call.mockRejectedValue(new Error("RPC unavailable"));
  expect(await (await request("players=0xa")).json()).toEqual({ error: "ratings_unavailable" });
  vi.mocked(RpcProvider.prototype.getChainId).mockResolvedValue("0x534e5f5345504f4c4941");
  call.mockClear();
  expect((await request("players=0xa")).status).toBe(503);
  expect(call).not.toHaveBeenCalled();
  query.mockResolvedValue({ results: [{ realmsId: "0x1", address: "not-a-wallet" }] });
  expect((await request("realmsIds=0x1")).status).toBe(503);
});

it("bounds simultaneous calls, keeps one confirmed block, and reads changes afresh on the next request", async () => {
  let active = 0;
  let peak = 0;
  let rating = 1200n;
  call.mockImplementation(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return [`0x${(rating * 10n ** 18n).toString(16)}`, "0x0"];
  });
  const owners = Array.from({ length: 24 }, (_, i) => `0x${(i + 1).toString(16)}`).join(",");
  expect((await request(`players=${owners}`)).status).toBe(200);
  expect(peak).toBeGreaterThan(1);
  expect(peak).toBeLessThanOrEqual(100);
  for (const args of call.mock.calls) expect(args[1]).toBe("0xabc");
  rating = 1300n;
  vi.mocked(RpcProvider.prototype.getBlock).mockResolvedValue({ block_number: 78, block_hash: "0xabd" } as Awaited<
    ReturnType<RpcProvider["getBlock"]>
  >);
  expect(await (await request("players=0x1")).json()).toMatchObject({ ratings: { "0x1": { rating: "1300" } } });
});

it("uses the existing public budget before reading identities or calling the ledger", async () => {
  vi.mocked(env.PUBLIC_RATE_LIMIT.limit).mockResolvedValue({ success: false });
  const response = await request("players=0xa");
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: "too_many_requests" });
  expect(call).not.toHaveBeenCalled();
});

it("reads the top list's named hash and rejects a response for another block", async () => {
  expect((await request("players=0xa")).status).toBe(200);
  vi.mocked(RpcProvider.prototype.getBlock).mockClear();
  const first = await request("players=0xa&block_hash=0xabc");
  expect(first.status).toBe(200);
  expect(RpcProvider.prototype.getBlock).not.toHaveBeenCalled();
  expect((await request("players=0xa&block_hash=0xdef")).status).toBe(503);
  expect((await request("players=0xa&block_hash=0x0")).status).toBe(400);
});

it("resolves another player's approved gameplay account to the same linked wallet rating", async () => {
  query.mockResolvedValue({
    results: [
      { account: "0x11", address: "0xa" },
      { account: "0x12", address: null },
    ],
  });
  const response = await request("accounts=0x011,0x12,0x13");
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    ratings: {
      "0x011": { status: "rated", player: "0xa", rating: "1000" },
      "0x12": { status: "unlinked", player: null, rating: null },
      "0x13": { status: "unknown_identity", player: null, rating: null },
    },
  });
  expect(query).toHaveBeenCalledWith(["0x11", "0x12", "0x13"]);
  expect(call).toHaveBeenCalledTimes(1);
});
