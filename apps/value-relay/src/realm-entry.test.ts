import { beforeEach, expect, it, onTestFinished, vi } from "vitest";
import { CairoOption, CairoOptionVariant, CallData, RpcProvider } from "starknet";
import { Effect } from "effect";
import { nativeReleaseConstants } from "../../../contracts/l3/world-native/schema/client.gen";
import { gamesAbi } from "../../../packages/value-ledger/test-support/abi";
import { holdsRealm as identityHoldsRealm } from "../../realms/server/realm-holdings";
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
  held: vi.fn(),
  seal: vi.fn(),
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
    holdsSeal: io.seal,
  },
};
const entitlement = { realm_id: 711n, metadata_1: 0n, metadata_2: 0n, metadata_3: 0n, pass_kind: 2n };
let registered: typeof entitlement | undefined;
let entryRule: number;
let settledHome: bigint;
let release: number;
let seals: Record<string, unknown>[];
beforeEach(() => {
  vi.resetAllMocks();
  registered = undefined;
  entryRule = 1;
  settledHome = 0n;
  release = 8;
  seals = [];
  io.seal.mockResolvedValue(false);
  io.account.mockResolvedValue("0x123");
  io.wallet.mockResolvedValue("0x456");
  io.owner.mockResolvedValue("0x456");
  io.snapshot.mockImplementation(async () => ({
    models: [
      {
        model: "GameRegistry",
        rows: [{ value: { start_settling_at: 100, end_at: 1000, settled: false } }],
      },
      { model: "SliceRules", rows: [{ value: { entry_rule: entryRule, day_unit_seconds: 86400 } }] },
      { model: "GameRelease", rows: [{ value: { release_id: release } }] },
      { model: "EntryEntitlement", rows: registered ? [{ value: { owner: claim.account, ...registered } }] : [] },
      { model: "SettledRealm", rows: settledHome ? [{ value: { realm_id: 711, home: settledHome } }] : [] },
      { model: "Seal", rows: seals.map((value) => ({ value })) },
    ],
  }));
  io.view.mockImplementation(async (method: string) =>
    method === "settled_realm"
      ? settledHome
      : new CairoOption(registered ? CairoOptionVariant.Some : CairoOptionVariant.None, registered),
  );
  io.admin.mockImplementation(
    async (
      method: string,
      args: { entitlement: Record<keyof typeof entitlement, number | string>; account?: string },
    ) => {
      new CallData(gamesAbi).compile(method, args as never);
      if (method === "grant_seal") return void seals.push({ game_id: 7, account: args.account, granted_at: 500 });
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
it("grants a held Ancient Seal once as the account enters, then registers its source", async () => {
  release = nativeReleaseConstants.SEAL_RELEASE;
  io.seal.mockResolvedValue(true);
  expect(await registerHomeSource(target, claim)).toEqual({ realmId: 711 });
  expect(io.admin.mock.calls).toEqual([
    ["grant_seal", { game_id: 7, account: "0x123" }],
    [
      "register_entitlement",
      {
        key: { game_id: 7, owner: "0x123" },
        entitlement: { realm_id: 711, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: 2 },
      },
    ],
  ]);
  expect(io.seal).toHaveBeenCalledExactlyOnceWith("0x2");
  expect(await registerHomeSource(target, claim)).toEqual({ realmId: 711 });
  expect(io.admin).toHaveBeenCalledTimes(2);
  expect(io.seal).toHaveBeenCalledOnce();
});
it("grants no Seal in a game whose release has none, and enters it as before", async () => {
  release = nativeReleaseConstants.SEAL_RELEASE - 1;
  io.seal.mockResolvedValue(true);
  expect(await registerHomeSource(target, claim)).toEqual({ realmId: 711 });
  expect(io.admin).toHaveBeenCalledExactlyOnceWith("register_entitlement", expect.anything());
  expect(io.seal).not.toHaveBeenCalled();
});
it("grants a free home its held Seal and nothing to an account that holds none", async () => {
  release = nativeReleaseConstants.SEAL_RELEASE;
  const free = { ...claim, realmId: null };
  expect(await registerHomeSource(target, free)).toEqual({});
  expect(io.admin).not.toHaveBeenCalled();
  io.seal.mockResolvedValue(true);
  expect(await registerHomeSource(target, free)).toEqual({});
  expect(io.admin).toHaveBeenCalledExactlyOnceWith("grant_seal", { game_id: 7, account: "0x123" });
});
it("grants a Seal redeemed after entry without touching the home's source", async () => {
  release = nativeReleaseConstants.SEAL_RELEASE;
  registered = entitlement;
  io.seal.mockResolvedValue(true);
  const redeemed = { ...claim, realmId: null, sealOnly: true as const };
  expect(await registerHomeSource(target, redeemed)).toEqual({});
  expect(await registerHomeSource(target, redeemed)).toEqual({});
  expect(io.admin).toHaveBeenCalledExactlyOnceWith("grant_seal", { game_id: 7, account: "0x123" });
});
it("asks for a retry when identity cannot say or the chain refuses the Seal, and registers nothing", async () => {
  release = nativeReleaseConstants.SEAL_RELEASE;
  io.seal.mockRejectedValue(new Error("down"));
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "seal_check_unavailable" });
  io.seal.mockResolvedValue(true);
  io.admin.mockRejectedValue(new Error("refused"));
  await expect(registerHomeSource(target, claim)).rejects.toMatchObject({ code: "seal_grant_unavailable" });
  expect(io.admin).toHaveBeenCalledExactlyOnceWith("grant_seal", { game_id: 7, account: "0x123" });
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

it("after A's Realm transfers to B, refuses B's registration and keeps A's home", async () => {
  const buyer = { ...claim, realmsId: "0x3", account: "0x124" };
  io.account.mockImplementation(async (id: string) => (id === claim.realmsId ? claim.account : buyer.account));
  io.wallet.mockImplementation(async (id: string) => (id === claim.realmsId ? "0x456" : "0x457"));
  const firstRoute = route();
  const first = await handleRealmEntryRequest(request({ gameId: 7, realmId: 711 }), firstRoute);
  expect(first.status).toBe(200);
  expect(await first.json()).toEqual({ realmId: 711 });

  settledHome = 99n;
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

  expect(io.owner.mock.calls).toEqual([["711"], ["711"]]);
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
it("answers a held Realm already registered when the player enters again without its number", async () => {
  expect(await registerHomeSource(target, claim)).toEqual({ realmId: 711 });
  expect(await registerHomeSource(target, shared)).toEqual({ realmId: 711 });
  expect(io.admin).toHaveBeenCalledTimes(1);
});
it("takes the shared entry without a Realm number through the HTTP route and registers nothing", async () => {
  const deps = route();
  const response = await handleRealmEntryRequest(request({ gameId: 7 }), deps);
  expect([response.status, await response.json()]).toEqual([200, {}]);
  expect(deps.register).toHaveBeenCalledExactlyOnceWith(shared);
  expect(io.admin).not.toHaveBeenCalled();
});
