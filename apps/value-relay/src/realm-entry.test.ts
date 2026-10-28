import { beforeEach, expect, it, vi } from "vitest";
import { CairoOption, CairoOptionVariant, CallData, shortString } from "starknet";
import { gamesAbi } from "../../../packages/value-ledger/test-support/abi";
import { handleRealmEntryRequest, registerHomeSource, type RealmEntryClaim } from "./realm-entry";
const io = vi.hoisted(() => ({
  snapshot: vi.fn(),
  view: vi.fn(),
  admin: vi.fn(),
  owner: vi.fn(),
  account: vi.fn(),
  wallet: vi.fn(),
  ticket: vi.fn(),
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
  identity: {
    accountForRealmsId: io.account,
    linkedWallet: io.wallet,
    realmOwnerOf: io.owner,
    campaignTicket: io.ticket,
  },
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
      {
        model: "GameRegistry",
        rows: [{ value: { start_settling_at: 100, end_at: 1000, settled: false, preset_id: 6 } }],
      },
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
  io.ticket.mockResolvedValue(null);
  io.admin.mockImplementation(
    async (method: string, args: { entitlement: Record<keyof typeof entitlement, number | string> }) => {
      new CallData(gamesAbi).compile(method, args as never);
      registered = Object.fromEntries(
        Object.entries(args.entitlement).map(([field, value]) => [field, BigInt(value)]),
      ) as typeof entitlement;
    },
  );
});
it("registers a live held Realm and answers an exact retry without another write", async () => {
  expect(await registerHomeSource(target, claim)).toEqual({ realmId: 711 });
  expect(io.admin).toHaveBeenCalledExactlyOnceWith("register_entitlement", {
    key: { game_id: 7, owner: "0x123" },
    entitlement: { realm_id: 711, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: 2 },
  });
  expect(await registerHomeSource(target, claim)).toEqual({ realmId: 711 });
  expect(io.admin).toHaveBeenCalledTimes(1);
  expect(io.owner).toHaveBeenCalledTimes(1);
});
it("refuses a Realm not currently held and a missing linked wallet", async () => {
  io.owner.mockResolvedValue("0x999");
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "realm_not_owned" });
  io.wallet.mockResolvedValue(null);
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "realm_wallet_missing" });
  expect(io.admin).not.toHaveBeenCalled();
});
it("does not register against another account, Blitz, or an already settled home", async () => {
  io.account.mockResolvedValue("0x999");
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "account_unavailable" });
  io.account.mockResolvedValue("0x123");
  entryRule = 2;
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "held_realm_requires_frontier" });
  entryRule = 1;
  entries = [{ player: "0x123" }];
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "owner_already_settled" });
  expect(io.admin).not.toHaveBeenCalled();
});
it("refuses a reused Realm and conflicting registration", async () => {
  settledHome = 99n;
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "realm_already_settled" });
  registered = { ...entitlement, realm_id: 712n };
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "conflicting_entry_entitlement" });
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
  register: vi.fn((entry: RealmEntryClaim) => registerHomeSource(target, entry)),
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

it("resumes the first registration after an NFT transfer and leaves a refused buyer free to choose another Realm", async () => {
  const saved = new Map<string, typeof entitlement>();
  const buyer = { ...claim, realmsId: "0x3", account: "0x124" };
  io.account.mockImplementation(async (id: string) => (id === claim.realmsId ? claim.account : buyer.account));
  io.wallet.mockImplementation(async (id: string) => (id === claim.realmsId ? "0x456" : "0x457"));
  io.view.mockImplementation(async (method: string, args: (string | number)[]) => {
    if (method === "settled_realm") return 0n;
    const entry = saved.get(String(args[1]));
    return new CairoOption(entry ? CairoOptionVariant.Some : CairoOptionVariant.None, entry);
  });
  io.admin.mockImplementation(
    async (
      method: string,
      args: {
        key: { game_id: number; owner: string };
        entitlement: { realm_id: number };
      },
    ) => {
      new CallData(gamesAbi).compile(method, args as never);
      if (args.key.owner === buyer.account && args.entitlement.realm_id === 711)
        throw new Error("Realm already registered");
      saved.set(args.key.owner, { ...entitlement, realm_id: BigInt(args.entitlement.realm_id) });
    },
  );
  const firstRoute = route();
  const buyerRoute = { ...route(), authenticate: async () => ({ realmsId: buyer.realmsId }) };
  const first = await handleRealmEntryRequest(request({ gameId: 7, realmId: 711 }), firstRoute);
  expect(first.status).toBe(200);
  expect(await first.json()).toEqual({ realmId: 711 });
  io.owner.mockResolvedValue("0x457");
  const refused = await handleRealmEntryRequest(request({ gameId: 7, realmId: 711 }), buyerRoute);
  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: "realm_registration_refused" });
  expect(saved.has(buyer.account)).toBe(false);
  const resumed = await handleRealmEntryRequest(request({ gameId: 7, realmId: 711 }), firstRoute);
  expect(resumed.status).toBe(200);
  expect(await resumed.json()).toEqual({ realmId: 711 });
  expect(io.owner.mock.calls).toEqual([["711"], ["711"]]);
  const alternative = await handleRealmEntryRequest(request({ gameId: 7, realmId: 712 }), buyerRoute);
  expect(alternative.status).toBe(200);
  expect(await alternative.json()).toEqual({ realmId: 712 });
  expect(saved.get(claim.account)?.realm_id).toBe(711n);
  expect(saved.get(buyer.account)?.realm_id).toBe(712n);
});

const shared: RealmEntryClaim = { ...claim, realmId: null };
const devcon = shortString.encodeShortString("devcon-2026");
it("registers the campaign ticket identity holds for this game's preset, and answers a retry without another write", async () => {
  io.ticket.mockResolvedValue({ campaign: "devcon-2026", tier: "golden" });
  expect(await registerHomeSource(target, shared)).toEqual({ campaign: "devcon-2026", tier: "golden" });
  expect(io.ticket).toHaveBeenCalledWith("0x2", 6);
  expect(io.admin).toHaveBeenCalledExactlyOnceWith("register_entitlement", {
    key: { game_id: 7, owner: "0x123" },
    entitlement: { realm_id: 0, metadata_1: devcon, metadata_2: 2, metadata_3: 0, pass_kind: 3 },
  });
  expect(await registerHomeSource(target, shared)).toEqual({ campaign: "devcon-2026", tier: "golden" });
  expect(io.admin).toHaveBeenCalledTimes(1);
  // The source is fixed: naming a Realm afterwards is refused, never swapped.
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "conflicting_entry_entitlement" });
});
it("registers nothing for an account with no ticket, or a free home already founded", async () => {
  expect(await registerHomeSource(target, shared)).toEqual({});
  io.ticket.mockResolvedValue({ campaign: "devcon-2026", tier: "regular" });
  entries = [{ player: "0x123" }];
  expect(await registerHomeSource(target, shared)).toEqual({});
  expect(io.admin).not.toHaveBeenCalled();
});
it("answers a held Realm already registered when the player enters again without its number", async () => {
  expect(await registerHomeSource(target, claim)).toEqual({ realmId: 711 });
  io.ticket.mockResolvedValue({ campaign: "devcon-2026", tier: "golden" });
  expect(await registerHomeSource(target, shared)).toEqual({ realmId: 711 });
  expect(io.admin).toHaveBeenCalledTimes(1);
  expect(io.ticket).not.toHaveBeenCalled();
});
it("takes the shared entry without a Realm number through the HTTP route", async () => {
  io.ticket.mockResolvedValue({ campaign: "devcon-2026", tier: "regular" });
  const deps = route();
  deps.register.mockImplementation((entry: RealmEntryClaim) => registerHomeSource(target, entry));
  const response = await handleRealmEntryRequest(request({ gameId: 7 }), deps);
  expect([response.status, await response.json()]).toEqual([200, { campaign: "devcon-2026", tier: "regular" }]);
  expect(deps.register).toHaveBeenCalledExactlyOnceWith(shared);
});
