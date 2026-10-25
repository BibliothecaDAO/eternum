import { beforeEach, expect, it, vi } from "vitest";
import { CairoOption, CairoOptionVariant, CallData } from "starknet";
import { gamesAbi } from "../../../packages/value-ledger/test-support/abi";
import { handleRealmEntryRequest, registerHeldRealm, type RealmEntryClaim } from "./realm-entry";
const io = vi.hoisted(() => ({
  snapshot: vi.fn(),
  view: vi.fn(),
  admin: vi.fn(),
  owner: vi.fn(),
  account: vi.fn(),
  wallet: vi.fn(),
}));
vi.mock("./shard-snapshot", async (original) => ({
  ...(await original<typeof import("./shard-snapshot")>()),
  readConfirmedSnapshot: io.snapshot,
}));
vi.mock("./shard-rpc", async (original) => ({
  ...(await original<typeof import("./shard-rpc")>()),
  ShardReader: class {
    async header() {
      return { timestamp: 500 };
    }
  },
}));
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    view = io.view;
    admin = io.admin;
  },
}));
const claim: RealmEntryClaim = { gameId: 7, realmId: 711, chainId: "0x1", realmsId: "0x2", account: "0x123" };
const target = {
  connection: { chainId: "0x1", gamesAddress: "0x10", rpcUrl: "https://shard.test/rpc" },
  heraldUrl: "https://shard.test",
  operatorAddress: "0x20",
  privateKey: "0x1",
  identity: { accountForRealmsId: io.account, linkedWallet: io.wallet, realmOwnerOf: io.owner },
};
const entitlement = { realm_id: 711n, metadata_1: 0n, metadata_2: 0n, metadata_3: 0n, pass_kind: 2n };
let registered: typeof entitlement | undefined;
let entries: Record<string, unknown>[];
let entryRule: number;
let settledHome: bigint;
beforeEach(() => {
  vi.resetAllMocks();
  registered = undefined;
  entries = [];
  entryRule = 1;
  settledHome = 0n;
  io.account.mockResolvedValue("0x123");
  io.wallet.mockResolvedValue("0x456");
  io.owner.mockResolvedValue("0x456");
  io.snapshot.mockImplementation(async () => ({
    models: [
      { model: "GameRegistry", rows: [{ value: { start_settling_at: 100, end_at: 1000, settled: false } }] },
      { model: "SliceRules", rows: [{ value: { entry_rule: entryRule, day_unit_seconds: 86400 } }] },
      { model: "GameRelease", rows: [{ value: { release_id: 3 } }] },
      { model: "PlayerEntry", rows: entries.map((value) => ({ value })) },
    ],
  }));
  io.view.mockImplementation(async (method: string) =>
    method === "settled_realm"
      ? settledHome
      : new CairoOption(registered ? CairoOptionVariant.Some : CairoOptionVariant.None, registered),
  );
  io.admin.mockImplementation(async (method: string, args: Record<string, unknown>) => {
    new CallData(gamesAbi).compile(method, args as never);
    registered = entitlement;
  });
});
it("registers a live held Realm and answers an exact retry without another write", async () => {
  expect(await registerHeldRealm(target, claim)).toEqual({ realmId: 711 });
  expect(io.admin).toHaveBeenCalledExactlyOnceWith("register_entitlement", {
    key: { game_id: 7, owner: "0x123" },
    entitlement: { realm_id: 711, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: 2 },
  });
  expect(await registerHeldRealm(target, claim)).toEqual({ realmId: 711 });
  expect(io.admin).toHaveBeenCalledTimes(1);
  expect(io.owner).toHaveBeenCalledTimes(2);
});
it("refuses a Realm not currently held and a missing linked wallet", async () => {
  io.owner.mockResolvedValue("0x999");
  await expect(registerHeldRealm(target, claim)).rejects.toMatchObject({ code: "realm_not_owned" });
  io.wallet.mockResolvedValue(null);
  await expect(registerHeldRealm(target, claim)).rejects.toMatchObject({ code: "realm_wallet_missing" });
  expect(io.admin).not.toHaveBeenCalled();
});
it("does not register against another account, Blitz, or an already settled home", async () => {
  io.account.mockResolvedValue("0x999");
  await expect(registerHeldRealm(target, claim)).rejects.toMatchObject({ code: "account_unavailable" });
  io.account.mockResolvedValue("0x123");
  entryRule = 2;
  await expect(registerHeldRealm(target, claim)).rejects.toMatchObject({ code: "held_realm_requires_frontier" });
  entryRule = 1;
  entries = [{ player: "0x123" }];
  await expect(registerHeldRealm(target, claim)).rejects.toMatchObject({ code: "owner_already_settled" });
  expect(io.admin).not.toHaveBeenCalled();
});
it("refuses a reused Realm and conflicting registration", async () => {
  settledHome = 99n;
  await expect(registerHeldRealm(target, claim)).rejects.toMatchObject({ code: "realm_already_settled" });
  registered = { ...entitlement, realm_id: 712n };
  await expect(registerHeldRealm(target, claim)).rejects.toMatchObject({ code: "conflicting_entry_entitlement" });
  expect(io.admin).not.toHaveBeenCalled();
});
const request = (body: unknown, origin = "https://game.test") =>
  new Request("https://game.test/api/value/realm-entry", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const route = () => ({
  origin: "https://game.test",
  chainId: "0x1",
  authenticate: async () => ({ realmsId: "0x2" }),
  accountForRealmsId: io.account,
  register: vi.fn((entry: RealmEntryClaim) => registerHeldRealm(target, entry)),
});
it("authenticates the real route and never accepts a caller-supplied account", async () => {
  const deps = route();
  expect((await handleRealmEntryRequest(request({ gameId: 7, realmId: 711, account: "0x999" }), deps)).status).toBe(
    400,
  );
  expect((await handleRealmEntryRequest(request({ gameId: 7, realmId: 711 }, "https://other.test"), deps)).status).toBe(
    403,
  );
  expect(
    (await handleRealmEntryRequest(request({ gameId: 7, realmId: 711 }), { ...deps, authenticate: async () => null }))
      .status,
  ).toBe(401);
  expect(deps.register).not.toHaveBeenCalled();
  const response = await handleRealmEntryRequest(request({ gameId: 7, realmId: 711 }), deps);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ realmId: 711 });
  expect(deps.register).toHaveBeenCalledExactlyOnceWith(claim);
});
it("answers realm_not_owned through the HTTP route", async () => {
  io.owner.mockResolvedValue("0x999");
  const response = await handleRealmEntryRequest(request({ gameId: 7, realmId: 711 }), route());
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "realm_not_owned" });
});
it.each([0, 8001, 1.5, "711"])("refuses invalid Realm number %s", async (realmId) => {
  const deps = route();
  expect((await handleRealmEntryRequest(request({ gameId: 7, realmId }), deps)).status).toBe(400);
  expect(deps.register).not.toHaveBeenCalled();
});
