import { dayOf } from "../../../packages/core/src/utils/days";
import { CallData, CairoOption, CairoOptionVariant } from "starknet";
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { gamesAbi } from "../../../packages/value-ledger/test-support/abi";
import { writeLaborGrant, currentLaborDay } from "./shard-labor";
import { handleLaborRequest } from "./labor-route";
import type { LaborClaim } from "./ports";

const rpc = vi.hoisted(() => ({ view: vi.fn(), admin: vi.fn(), header: vi.fn(), snapshot: vi.fn() }));
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    view = rpc.view;
    admin = rpc.admin;
  },
}));
vi.mock("./shard-rpc", async (original) => ({
  ...(await original<typeof import("./shard-rpc")>()),
  ShardReader: class {
    header = rpc.header;
  },
}));
vi.mock("./shard-snapshot", async (original) => ({
  ...(await original<typeof import("./shard-snapshot")>()),
  readConfirmedSnapshot: rpc.snapshot,
}));
const target = {
  connection: { chainId: "0x1", rpcUrl: "https://shard.test/rpc", gamesAddress: "0x10" },
  operatorAddress: "0x20",
  privateKey: "0x1",
};
const claim: LaborClaim = { chainId: "0x1", gameId: 7, home: "9", day: 0, realmsId: "0x2", account: "0x123" };
const grant = { game_id: 7n, account: 0x123n, home: 9n, amount: 1000n, essence: 0n };
let saved: typeof grant | undefined;
beforeEach(() => {
  vi.resetAllMocks();
  saved = undefined;
  rpc.header.mockResolvedValue({ timestamp: 86401 });
  rpc.snapshot.mockResolvedValue({
    models: [
      { model: "GameRegistry", rows: [{ value: { seed: "711", start_main_at: 360, end_at: 288360 } }] },
      { model: "SliceRules", rows: [{ value: { day_unit_seconds: 7200 } }] },
    ],
  });
  rpc.view.mockImplementation(async (method: string) =>
    method === "ledger_operator"
      ? 0x20n
      : new CairoOption(saved ? CairoOptionVariant.Some : CairoOptionVariant.None, saved),
  );
  rpc.admin.mockImplementation(async (method: string, args: Record<string, unknown>) => {
    new CallData(gamesAbi).compile(method, args as never);
    saved = grant;
  });
});
it("writes one home claim using the published ABI and retries without a second write", async () => {
  const result = await Effect.runPromise(writeLaborGrant(target, claim));
  expect(result).toEqual({
    gameId: 7,
    account: expect.stringMatching(/123$/),
    home: "9",
    amount: "1000",
    essence: "0",
  });
  expect(rpc.admin).toHaveBeenCalledExactlyOnceWith("grant_labor", {
    home: { game_id: 7, home: 9n },
    day: 0,
    account: "0x123",
  });
  expect(await Effect.runPromise(writeLaborGrant(target, claim))).toEqual(result);
  expect(rpc.admin).toHaveBeenCalledTimes(1);
});
it.each([
  [1000n, 1000n],
  [2000n, 2000n],
])("returns the recorded campaign grant (%s Labor, %s Essence)", async (amount, essence) => {
  saved = { ...grant, amount, essence };
  expect(await Effect.runPromise(writeLaborGrant(target, claim))).toMatchObject({
    amount: String(amount),
    essence: String(essence),
  });
  expect(rpc.admin).not.toHaveBeenCalled();
});
it("accepts a recorded zero payout without minting again", async () => {
  saved = { ...grant, amount: 0n };
  expect((await Effect.runPromise(writeLaborGrant(target, claim))).amount).toBe("0");
  expect(rpc.admin).not.toHaveBeenCalled();
});
it("refuses another account's receipt and a different chain", async () => {
  saved = { ...grant, account: 0x456n };
  await expect(Effect.runPromise(writeLaborGrant(target, claim))).rejects.toThrow();
  await expect(Effect.runPromise(writeLaborGrant(target, { ...claim, chainId: "0x2" }))).rejects.toThrow();
  expect(rpc.admin).not.toHaveBeenCalled();
});
it("uses all ten seeded Devcon game days and refuses outside the season", async () => {
  const calendar = { seed: 711n, startMainAt: 360, dayUnitSeconds: 7200 };
  let timestamp = calendar.startMainAt;
  for (let index = 0; index < 10; index++) {
    const day = dayOf(calendar, timestamp)!;
    for (const time of [day.start, day.end - 1]) {
      rpc.header.mockResolvedValue({ timestamp: time });
      expect(await Effect.runPromise(currentLaborDay(target.connection, "https://herald.test", 7))).toBe(index);
    }
    timestamp = day.end;
  }
  expect(timestamp).toBe(288360);
  for (const time of [359, 288360]) {
    rpc.header.mockResolvedValue({ timestamp: time });
    await expect(Effect.runPromise(currentLaborDay(target.connection, "https://herald.test", 7))).rejects.toMatchObject(
      { operation: "read Frontier labor day" },
    );
  }
  expect(rpc.snapshot).toHaveBeenLastCalledWith(target.connection, "https://herald.test", 7, [
    "GameRegistry",
    "SliceRules",
  ]);
});
const request = (body: unknown, origin = "https://game.test") =>
  new Request("https://game.test/api/value/labor", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const route = () => ({
  origin: "https://game.test",
  chainId: "0x1",
  authenticate: async () => ({ realmsId: "0x2" }),
  accountForRealmsId: async () => "0x123",
  currentDay: vi.fn(() => Effect.succeed(4)),
  grant: vi.fn(async () => ({ gameId: 7, account: "0x123", home: "9", amount: "1000", essence: "0" })),
});
it("derives the account and day, accepting only one settled home", async () => {
  const deps = route();
  const response = await handleLaborRequest(request({ gameId: 7, home: "9" }), deps);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    day: 4,
    grant: { gameId: 7, account: "0x123", home: "9", amount: "1000", essence: "0" },
  });
  expect(deps.currentDay).toHaveBeenCalledExactlyOnceWith(7);
  expect(deps.grant).toHaveBeenCalledExactlyOnceWith({ ...claim, day: 4 });
});
it.each([
  { realms: [{ realmId: 1, gameId: 7, home: "9" }] },
  { gameId: 7, home: "9", account: "0x456" },
  { gameId: 7, home: "0" },
  { gameId: 7, home: "18446744073709551616" },
  { gameId: 0, home: "9" },
])("refuses an invalid or obsolete claim %j", async (body) => {
  const deps = route();
  expect((await handleLaborRequest(request(body), deps)).status).toBe(400);
  expect(deps.grant).not.toHaveBeenCalled();
});
it("refuses cross-origin and anonymous writes", async () => {
  const deps = route();
  expect((await handleLaborRequest(request({ gameId: 7, home: "9" }, "https://other.test"), deps)).status).toBe(403);
  expect(
    (await handleLaborRequest(request({ gameId: 7, home: "9" }), { ...deps, authenticate: async () => null })).status,
  ).toBe(401);
  expect(deps.grant).not.toHaveBeenCalled();
});
