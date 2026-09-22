import { describe, expect, test, mock } from "bun:test";
import { CallData, type Account, type RpcProvider } from "starknet";
import schemaJson from "../../../../../contracts/l3/world-native/schema/schema.json";
import { canonicalRealmTraits, realmCatalogueDigest } from "./realm-catalogue";
import { loadNativeWorld } from "./artifacts";
import { inspectNativeWorld } from "./plan";
import { deployNativeWorld } from "./deploy";
import { buildNativeManifest } from "./manifest";
import type { NativeWorld } from "./types";

mock.module("../../shared/transaction", () => ({
  confirmedTransactionReceipt: mock(async () => ({ block_number: 42, execution_status: "SUCCEEDED" })),
}));

const authentication = { submitter: "0x99", registry: "0x88", account_class: "0x77" };
function fixture() {
  const domains = Object.keys(schemaJson.domains).map((name, index) => ({
    name,
    address: `0x${index + 1}`,
    classHash: "0x123",
    constructorCalldata: [],
    salt: "0x1",
    sierra: {
      abi: [
        ...Object.values(schemaJson.types),
        ...schemaJson.domains[name as keyof typeof schemaJson.domains].entrypoints,
      ],
    },
  }));
  const local = {
    seed: "native-test",
    authority: "0x99",
    authentication,
    schema: schemaJson,
    domains,
  } as unknown as NativeWorld;
  const peers = Object.fromEntries(domains.map((domain) => [domain.name, domain.address]));
  const state = { authority: local.authority, peers, active: true };
  const catalogue = {
    initialized: canonicalRealmTraits.length,
    digest: realmCatalogueDigest(canonicalRealmTraits.length),
  };
  const rpc = {
    getBlockNumber: async () => 10,
    getClass: async () => ({}),
    getClassHashAt: async () => "0x123",
    callContract: async ({ entrypoint }: { entrypoint: string }) => [
      ...(entrypoint === "domain_state"
        ? [
            state.authority,
            ...schemaJson.types["world_native::lifecycle::Peers"].members.map((member) => state.peers[member.name]),
            state.active ? "1" : "0",
          ]
        : entrypoint === "realm_catalogue"
          ? [String(catalogue.initialized), catalogue.digest]
          : Object.values(authentication)),
    ],
  };
  return { local, rpc, state, catalogue };
}

describe("native deployment planning", () => {
  test("a different seed cannot overwrite a non-native release manifest", () => {
    expect(() =>
      loadNativeWorld({
        artifacts: "missing",
        schemaPath: "missing",
        seed: "native-new",
        authority: "0x99",
        authentication,
        previous: { world: { seed: "old-release" } } as never,
      }),
    ).toThrow("Cannot replace a non-native world");
  });
  test("an unchanged deployment submits zero transactions", async () => {
    const { local, rpc } = fixture();
    const report = await deployNativeWorld(local, rpc as unknown as Account, () => {
      throw new Error("unexpected transaction");
    });
    expect(report.before.synced).toBe(true);
    expect(report.after.synced).toBe(true);
    expect(report.transactions).toEqual([]);
  });
  test("class declaration uses the deployer while administration uses the bound operator", async () => {
    const { local, rpc, state } = fixture();
    state.active = false;
    const declared: string[] = [];
    const activated: string[] = [];
    const declarer = {
      getClass: async () => {
        throw { code: 28 };
      },
      declare: async ({ classHash }: { classHash: string }) => {
        declared.push(classHash);
        return { transaction_hash: "0xdec" };
      },
    };
    const operator = {
      ...rpc,
      execute: async (call: { contractAddress: string; entrypoint: string }) => {
        expect(call.entrypoint).toBe("activate");
        activated.push(call.contractAddress);
        if (activated.length === local.domains.length) state.active = true;
        return { transaction_hash: "0xac" };
      },
    };
    const report = await deployNativeWorld(
      local,
      operator as unknown as Account,
      () => {},
      declarer as unknown as Account,
    );
    expect(declared).toEqual(local.domains.map(({ classHash }) => classHash));
    expect(activated).toEqual(local.domains.map(({ address }) => address));
    expect(report.after.synced).toBe(true);
  });
  test("a matching catalogue prefix needs initialization without a blocker", async () => {
    const { local, rpc, catalogue } = fixture();
    catalogue.initialized = 128;
    catalogue.digest = realmCatalogueDigest(128);
    const plan = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    expect(plan.synced).toBe(false);
    expect(plan.blockers).toEqual([]);
    expect(plan.domains.find((domain) => domain.name === "settlement")?.realmCatalogue).toEqual(catalogue);
  });
  test("a resumed deployment writes only the missing immutable suffix", async () => {
    const { local, rpc, catalogue } = fixture();
    catalogue.initialized = 7990;
    catalogue.digest = realmCatalogueDigest(7990);
    const submitted: string[] = [];
    const account = {
      ...rpc,
      execute: async (call: { entrypoint: string; calldata: string[] }) => {
        expect(call.entrypoint).toBe("initialize_realm_traits");
        expect(call.calldata.map(BigInt)).toEqual([7991n, 10n, ...canonicalRealmTraits.slice(7990).map(BigInt)]);
        catalogue.initialized = canonicalRealmTraits.length;
        catalogue.digest = realmCatalogueDigest(catalogue.initialized);
        return { transaction_hash: "0xabc" };
      },
    };
    const report = await deployNativeWorld(local, account as unknown as Account, (transaction) =>
      submitted.push(transaction.hash),
    );
    expect(submitted).toEqual(["0xabc"]);
    expect(report.after.synced).toBe(true);
    expect(report.transactions).toEqual([{ action: "initialize_realm_traits", domain: "settlement", hash: "0xabc" }]);
  });
  test("a changed catalogue prefix blocks before transactions", async () => {
    const { local, rpc, catalogue } = fixture();
    catalogue.digest = "0x1";
    await expect(
      deployNativeWorld(local, rpc as unknown as Account, () => {
        throw new Error("unexpected transaction");
      }),
    ).rejects.toThrow("realm catalogue content mismatch");
  });
  test("peer and authority mismatches block before declaration or activation", async () => {
    const { local, rpc, state } = fixture();
    state.authority = "0x42";
    state.peers.map = "0x55";
    const plan = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    expect(plan.synced).toBe(false);
    expect(plan.blockers).toContain("season: authority mismatch");
    expect(plan.blockers).toContain("season: peer mismatch");
    await expect(deployNativeWorld(local, rpc as unknown as Account, () => {})).rejects.toThrow("mismatch");
  });
  test("an inactive but configured world is not reported synced", async () => {
    const { local, rpc, state } = fixture();
    state.active = false;
    const plan = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    expect(plan.synced).toBe(false);
    expect(plan.blockers).toEqual([]);
  });
  test("the release retains deployment identity and historical codecs across upgrades", async () => {
    const { local, rpc } = fixture();
    const plan = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    const shard = { chainId: "0x1", accountClassHash: "0x2", contracts: {}, guardianPublicKey: "0x3" };
    const first = buildNativeManifest(local, plan, shard);
    local.previous = first;
    local.domains.find((domain) => domain.name === "season")!.classHash = "0x456";
    const second = buildNativeManifest(local, { ...plan, blockNumber: 100 }, shard);
    expect(second.shard.chainId).toBe(first.shard.chainId);
    expect(second.native.deploymentBlock).toBe(10);
    expect(second.native.domains.season.initialClassHash).toBe("0x123");
    expect(Object.keys(second.native.domains.season.classes)).toEqual(["0x123", "0x456"]);
    expect(second.world.address).toBe(first.world.address);
  });
});
