import { describe, expect, test } from "bun:test";
import { CallData, type Account, type RpcProvider } from "starknet";
import schemaJson from "../../../../../contracts/l3/world-native/schema/schema.json";
import { loadNativeWorld } from "./artifacts";
import { inspectNativeWorld } from "./plan";
import { deployNativeWorld } from "./deploy";
import { buildNativeManifest } from "./manifest";
import type { NativeWorld } from "./types";

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
  const rpc = {
    getBlockNumber: async () => 10,
    getClass: async () => ({}),
    getClassHashAt: async () => "0x123",
    callContract: async ({ entrypoint }: { entrypoint: string }) => [
      ...(entrypoint === "domain_state"
        ? [
            state.authority,
            state.peers.season,
            state.peers.map,
            state.peers.structures,
            state.peers.troops,
            state.active ? "1" : "0",
          ]
        : Object.values(authentication)),
    ],
  };
  return { local, rpc, state };
}

describe("native deployment planning", () => {
  test("a different seed cannot overwrite a Dojo release manifest", () => {
    expect(() =>
      loadNativeWorld({
        artifacts: "missing",
        schemaPath: "missing",
        seed: "native-new",
        authority: "0x99",
        authentication,
        previous: { world: { seed: "old-dojo" } } as never,
      }),
    ).toThrow("Cannot replace a Dojo world");
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
    const first = buildNativeManifest(local, plan);
    local.previous = first;
    local.domains[0].classHash = "0x456";
    const second = buildNativeManifest(local, { ...plan, blockNumber: 100 });
    expect(second.native.deploymentBlock).toBe(10);
    expect(second.native.domains.season.initialClassHash).toBe("0x123");
    expect(Object.keys(second.native.domains.season.classes)).toEqual(["0x123", "0x456"]);
    expect(second.world.address).toBe(first.world.address);
  });
});
