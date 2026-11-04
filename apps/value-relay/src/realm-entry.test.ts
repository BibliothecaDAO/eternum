import { beforeEach, expect, it, onTestFinished, vi } from "vitest";
import { CairoOption, CairoOptionVariant, CallData, RpcProvider, shortString } from "starknet";
import { Effect } from "effect";
import { gamesAbi } from "../../../packages/value-ledger/test-support/abi";
import { holdsRealm as identityHoldsRealm } from "../../realms/server/realm-holdings";
import { handleLaborRequest } from "./labor-route";
import { writeLaborGrant } from "./shard-labor";
import {
  handleHeldRealmsRequest,
  handleRealmEntryRequest,
  registerHomeSource,
  type RealmEntryClaim,
} from "./realm-entry";
const io = vi.hoisted(() => ({
  snapshot: vi.fn(),
  view: vi.fn(),
  admin: vi.fn(),
  owner: vi.fn(),
  account: vi.fn(),
  wallet: vi.fn(),
  ticket: vi.fn(),
  held: vi.fn(),
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
  connection: { chainId: "0x1", gamesAddress: "0x10", rpcUrl: "https://shard.test/rpc", firstRelease: 1 },
  heraldUrl: "https://shard.test",
  operatorAddress: "0x20",
  privateKey: "0x1",
  identity: {
    accountForRealmsId: io.account,
    linkedWallet: io.wallet,
    /** The chain's owner of the Realm, as identity's holdings reader answers for a wallet. */
    holdsRealm: async (wallet: string, realmId: number) => BigInt(await io.owner(String(realmId))) === BigInt(wallet),
    heldRealmsWithMaps: io.held,
    campaignTicket: io.ticket,
  },
};
const entitlement = { realm_id: 711n, metadata_1: 0n, metadata_2: 0n, metadata_3: 0n, pass_kind: 2n };
let registered: typeof entitlement | undefined;
let entries: Record<string, unknown>[];
let entryRule: number;
let settledHome: bigint;
let release: number;
let campaignHomes: Record<string, unknown>[];
let structures: Record<string, unknown>[];
beforeEach(() => {
  vi.resetAllMocks();
  registered = undefined;
  entries = [];
  entryRule = 1;
  settledHome = 0n;
  release = 8;
  campaignHomes = [];
  structures = [];
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
      { model: "GameRelease", rows: [{ value: { release_id: release } }] },
      { model: "PlayerEntry", rows: entries.map((value) => ({ value })) },
      { model: "CampaignHome", rows: campaignHomes.map((value) => ({ value })) },
      { model: "Structure", rows: structures.map((value) => ({ value })) },
      { model: "EntryEntitlement", rows: registered ? [{ value: { owner: claim.account, ...registered } }] : [] },
      { model: "SettledRealm", rows: settledHome ? [{ value: { realm_id: 711, home: settledHome } }] : [] },
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
      if (campaignHomes.length) campaignHomes[0]!.tier = registered.metadata_2;
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
it("does not register against another account or Blitz", async () => {
  io.account.mockResolvedValue("0x999");
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "account_unavailable" });
  io.account.mockResolvedValue("0x123");
  entryRule = 2;
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "held_realm_requires_frontier" });
  entryRule = 1;
  entries = [{ player: "0x123" }];
  expect(await registerHomeSource(target, claim)).toEqual({ realmId: 711 });
  expect(await registerHomeSource(target, claim)).toEqual({ realmId: 711 });
  expect(io.admin).toHaveBeenCalledOnce();
});
it("refuses a reused Realm and conflicting registration", async () => {
  settledHome = 99n;
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "realm_already_settled" });
  registered = { ...entitlement, realm_id: 712n };
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "conflicting_entry_entitlement" });
  expect(io.admin).not.toHaveBeenCalled();
});

it.each(["late upgrade", "held founding"])(
  "after A's Realm transfers to B, refuses B's %s and keeps A's daily claim",
  async (entryPath) => {
    const buyer = { ...claim, realmsId: "0x3", account: "0x124" };
    io.account.mockImplementation(async (id: string) => (id === claim.realmsId ? claim.account : buyer.account));
    io.wallet.mockImplementation(async (id: string) => (id === claim.realmsId ? "0x456" : "0x457"));
    const firstRoute = route();
    const first = await handleRealmEntryRequest(request({ gameId: 7, realmId: 711 }), firstRoute);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ realmId: 711 });

    settledHome = 99n;
    entries = [{ player: claim.account }];
    if (entryPath === "late upgrade") entries.push({ player: buyer.account });
    io.owner.mockResolvedValue("0x457");
    const buyerRoute = { ...route(), authenticate: async () => ({ realmsId: buyer.realmsId }) };
    const refused = await handleRealmEntryRequest(request({ gameId: 7, realmId: 711 }), buyerRoute);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "realm_already_settled" });
    expect(io.admin).toHaveBeenCalledTimes(1);
    expect(registered).toEqual(entitlement);
    expect(settledHome).toBe(99n);

    const resumed = await handleRealmEntryRequest(request({ gameId: 7, realmId: 711 }), firstRoute);
    expect(resumed.status).toBe(200);
    expect(await resumed.json()).toEqual({ realmId: 711 });
    expect(io.admin).toHaveBeenCalledTimes(1);

    const grant = { game_id: 7n, account: 0x123n, home: 99n, amount: 1000_000_000_000n, essence: 0n };
    let recorded: typeof grant | undefined;
    io.view.mockImplementation(async (method: string) =>
      method === "ledger_operator"
        ? 0x20n
        : new CairoOption(recorded ? CairoOptionVariant.Some : CairoOptionVariant.None, recorded),
    );
    io.admin.mockImplementation(async (method: string, args: Record<string, unknown>) => {
      new CallData(gamesAbi).compile(method, args as never);
      expect(method).toBe("grant_labor");
      expect(args).toEqual({ home: { game_id: 7, home: 99n }, day: 1, account: claim.account });
      recorded = grant;
      return { transactionHash: "0xabc" };
    });
    const dailyRequest = new Request("https://game.test/api/value/labor", {
      method: "POST",
      headers: { origin: "https://game.test", "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: 7, home: "99" }),
    });
    const paid = await handleLaborRequest(dailyRequest, {
      ...firstRoute,
      currentDay: () => Effect.succeed(1),
      grant: (dailyClaim) => Effect.runPromise(writeLaborGrant(target, dailyClaim)),
    });
    expect(paid.status).toBe(200);
    expect(await paid.json()).toMatchObject({
      day: 1,
      grant: { home: "99", amount: "1000000000000", essence: "0", transactionHash: "0xabc" },
    });
    expect(io.admin).toHaveBeenCalledTimes(2);
    expect(io.owner.mock.calls).toEqual([["711"], ["711"]]);
  },
);
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
it("asks the player to retry, never refuses, when no holdings source answers", async () => {
  io.owner.mockRejectedValue(new Error("realm_holdings_unavailable"));
  const response = await handleRealmEntryRequest(request({ gameId: 7, realmId: 711 }), route());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "realm_check_unavailable" });
  expect(io.admin).not.toHaveBeenCalled();
});
it("lists the linked wallet's Realms for the settle picker, none without a wallet, and a retry when the index is down", async () => {
  const deps = { ...route(), identity: target.identity };
  const held = [
    { realmId: 3, map: "https://market.test/assets/3.svg" },
    { realmId: 251, map: null },
  ];
  io.held.mockResolvedValue(held);
  const listed = await handleHeldRealmsRequest(request({}), deps);
  // Both shapes: the numbers a client from before the maps reads, and each Realm with its map for today's.
  expect(await listed.json()).toEqual({ realms: [3, 251], held });
  expect(io.held).toHaveBeenCalledExactlyOnceWith("0x456");
  io.wallet.mockResolvedValue(null);
  expect(await (await handleHeldRealmsRequest(request({}), deps)).json()).toEqual({ realms: [], held: [] });
  io.wallet.mockResolvedValue("0x456");
  io.held.mockRejectedValue(new Error("realm_holdings_unavailable"));
  const down = await handleHeldRealmsRequest(request({}), deps);
  expect(down.status).toBe(503);
  expect(await down.json()).toEqual({ error: "realm_holdings_unavailable" });
});
it("refuses registration to a seller the marketplace index still credits, and registers the buyer", async () => {
  const seller = "0x456";
  const buyer = "0x789";
  vi.stubGlobal("fetch", async () => Response.json({ data: { tokenId: "711", owner: seller } }));
  vi.spyOn(RpcProvider.prototype, "getChainId").mockResolvedValue("0x534e5f4d41494e");
  vi.spyOn(RpcProvider.prototype, "callContract").mockResolvedValue([buyer]);
  onTestFinished(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const identityEnv = {
    ENVIRONMENT: "staging" as const,
    L2_RPC_URL: "https://starknet-mainnet.g.alchemy.com/v2/test",
    MARKETPLACE_API_URL: "https://market.test/api/marketplace",
  };
  const live = {
    ...target,
    identity: {
      ...target.identity,
      holdsRealm: (wallet: string, realmId: number) => identityHoldsRealm(identityEnv, wallet, realmId),
    },
  };
  io.wallet.mockResolvedValue(seller);
  await expect(registerHomeSource(live, claim)).rejects.toMatchObject({ code: "realm_not_owned" });
  expect(io.admin).not.toHaveBeenCalled();
  io.wallet.mockResolvedValue(buyer);
  expect(await registerHomeSource(live, claim)).toEqual({ realmId: 711 });
  expect(io.admin).toHaveBeenCalledOnce();
});
it.each([0, 8001, 1.5, "711"])("refuses invalid Realm number %s", async (realmId) => {
  const deps = route();
  expect((await handleRealmEntryRequest(request({ gameId: 7, realmId }), deps)).status).toBe(400);
  expect(deps.register).not.toHaveBeenCalled();
});

it("resumes the first registration after an NFT transfer and leaves a refused buyer free to choose another Realm", async () => {
  const saved = new Map<string, typeof entitlement>();
  const buyer = { ...claim, realmsId: "0x3", account: "0x124" };
  const snapshot = io.snapshot.getMockImplementation()!;
  io.snapshot.mockImplementation(async (...args: unknown[]) => {
    const result = await snapshot(...args);
    result.models.find((model: { model: string }) => model.model === "EntryEntitlement").rows = [...saved].map(
      ([owner, value]) => ({ value: { owner, ...value } }),
    );
    return result;
  });
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
it("registers nothing without a ticket and attaches a ticket to a founded free home once", async () => {
  expect(await registerHomeSource(target, shared)).toEqual({});
  io.ticket.mockResolvedValue({ campaign: "devcon-2026", tier: "regular" });
  entries = [{ player: "0x123" }];
  expect(await registerHomeSource(target, shared)).toEqual({ campaign: "devcon-2026", tier: "regular" });
  expect(io.admin).toHaveBeenCalledOnce();
  expect(await registerHomeSource(target, shared)).toEqual({ campaign: "devcon-2026", tier: "regular" });
  expect(io.admin).toHaveBeenCalledOnce();
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

it("attests flyer recovery only for a founded Devcon home, including an interrupted ordinary registration", async () => {
  io.ticket.mockResolvedValue({ campaign: "devcon-2026", tier: "regular" });
  const recovery = { ...shared, recoverFlyer: true as const };
  await expect(registerHomeSource(target, recovery)).rejects.toMatchObject({
    code: "recovery_requires_founded_devcon_home",
  });
  expect(io.admin).not.toHaveBeenCalled();
  entries = [{ player: "0x123" }];
  await registerHomeSource(target, shared);
  expect(registered?.metadata_3).toBe(0n);
  expect(await registerHomeSource(target, recovery)).toEqual({ campaign: "devcon-2026", tier: "regular" });
  expect(registered?.metadata_3).toBe(BigInt(shortString.encodeShortString("devcon-recovery")));
  expect(await registerHomeSource(target, recovery)).toEqual({ campaign: "devcon-2026", tier: "regular" });
  expect(io.admin).toHaveBeenCalledTimes(2);
});
it("does not let a player attest flyer recovery", async () => {
  const deps = route();
  const response = await handleRealmEntryRequest(request({ gameId: 7, recoverFlyer: true }), deps);
  expect(response.status).toBe(400);
  expect(deps.register).not.toHaveBeenCalled();
});

function foundedRegularCampaign(marker = 0n) {
  entries = [{ player: claim.account }];
  registered = {
    realm_id: 0n,
    metadata_1: BigInt(shortString.encodeShortString("devcon-2026")),
    metadata_2: 1n,
    metadata_3: marker,
    pass_kind: 3n,
  };
  campaignHomes = [{ home: "0x99", campaign_id: registered.metadata_1, tier: 1n }];
  structures = [{ entity_id: "0x99", owner: claim.account }];
  io.ticket.mockResolvedValue({ campaign: "devcon-2026", tier: "golden" });
}
const promotion = { ...shared, upgradeCampaign: true as const };

it.each([0n, BigInt(shortString.encodeShortString("devcon-recovery"))])(
  "upgrades the attested founded home from marker %s and retries without another write",
  async (marker) => {
    foundedRegularCampaign(marker);
    const result = { campaign: "devcon-2026", tier: "golden" };
    expect(await registerHomeSource(target, promotion)).toEqual(result);
    expect(io.admin).toHaveBeenCalledExactlyOnceWith("register_entitlement", {
      key: { game_id: 7, owner: claim.account },
      entitlement: {
        realm_id: 0,
        metadata_1: shortString.encodeShortString("devcon-2026"),
        metadata_2: 2,
        metadata_3: shortString.encodeShortString("devcon-upgrade"),
        pass_kind: 3,
      },
    });
    expect(await registerHomeSource(target, promotion)).toEqual(result);
    expect(io.admin).toHaveBeenCalledTimes(1);
  },
);

it.each([
  "unfounded",
  "free",
  "held",
  "other campaign",
  "other owner",
  "home tier",
  "no ticket",
  "regular ticket",
  "old release",
  "mixed recovery",
])("refuses a golden upgrade for %s before writing", async (kind) => {
  foundedRegularCampaign();
  if (kind === "unfounded") entries = [];
  if (kind === "free") registered = undefined;
  if (kind === "held") registered = entitlement;
  if (kind === "other campaign") registered!.metadata_1 = 1n;
  if (kind === "other owner") structures[0]!.owner = "0x444";
  if (kind === "home tier") campaignHomes[0]!.tier = 2n;
  if (kind === "no ticket") io.ticket.mockResolvedValue(null);
  if (kind === "regular ticket") io.ticket.mockResolvedValue({ campaign: "devcon-2026", tier: "regular" });
  if (kind === "old release") release = 7;
  await expect(
    registerHomeSource(target, kind === "mixed recovery" ? { ...promotion, recoverFlyer: true } : promotion),
  ).rejects.toBeInstanceOf(Error);
  expect(io.admin).not.toHaveBeenCalled();
});

it("leaves a printed golden home unchanged and never lets a player attest promotion", async () => {
  foundedRegularCampaign();
  registered!.metadata_2 = 2n;
  campaignHomes[0]!.tier = 2n;
  expect(await registerHomeSource(target, promotion)).toEqual({ campaign: "devcon-2026", tier: "golden" });
  expect(registered!.metadata_3).toBe(0n);
  expect(io.admin).not.toHaveBeenCalled();
  const deps = route();
  const response = await handleRealmEntryRequest(request({ gameId: 7, upgradeCampaign: true }), deps);
  expect(response.status).toBe(400);
  expect(deps.register).not.toHaveBeenCalled();
});

it("recovers an uncertain upgrade from confirmed state without reopening flyer compensation", async () => {
  foundedRegularCampaign();
  const write = io.admin.getMockImplementation()!;
  io.admin.mockImplementationOnce(async (...args) => {
    await write(...args);
    throw new Error("response lost");
  });
  await expect(registerHomeSource(target, promotion)).rejects.toMatchObject({ code: "realm_registration_refused" });
  expect(await registerHomeSource(target, promotion)).toEqual({ campaign: "devcon-2026", tier: "golden" });
  await expect(registerHomeSource(target, { ...shared, recoverFlyer: true })).rejects.toMatchObject({
    code: "conflicting_entry_entitlement",
  });
  expect(io.admin).toHaveBeenCalledTimes(1);
});
