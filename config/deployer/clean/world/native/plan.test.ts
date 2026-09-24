import { describe, expect, test } from "bun:test";
import { type Account, type RpcProvider } from "starknet";
import schemaJson from "../../../../../contracts/l3/world-native/schema/schema.json";
import { canonicalRealmTraits, realmCatalogueDigest } from "./realm-catalogue";
import { loadNativeWorld } from "./artifacts";
import { inspectNativeWorld } from "./plan";
import { deployNativeWorld } from "./deploy";
import type { NativeWorld } from "./types";

const authentication = { submitter: "0x99", account_class: "0x77" };
function fixture() {
  const logic = Object.keys(schemaJson.logicClasses).map((name) => ({ name, classHash: "0x123" }));
  const local = {
    seed: "native-test",
    authority: "0x99",
    authentication,
    schema: schemaJson,
    logic,
    games: {
      address: "0x1",
      classHash: "0x123",
      constructorCalldata: [],
      salt: "0x1",
      sierra: { abi: [...Object.values(schemaJson.types), ...schemaJson.games.entrypoints] },
    },
  } as unknown as NativeWorld;
  const state = {
    authority: local.authority,
    classes: Object.fromEntries(logic.map(({ name, classHash }) => [name, classHash])),
    gamesClassHash: "0x123",
  };
  const catalogue = {
    initialized: canonicalRealmTraits.length,
    digest: realmCatalogueDigest(canonicalRealmTraits.length),
  };
  const rpc = {
    getBlockNumber: async () => 10,
    getClass: async () => ({}),
    getClassHashAt: async () => state.gamesClassHash,
    callContract: async ({ entrypoint }: { entrypoint: string }) => [
      ...(entrypoint === "deployment_configuration"
        ? [state.authority, ...Object.keys(schemaJson.logicClasses).map((name) => state.classes[name])]
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
    ).toThrow("Games requires a fresh deployment");
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

  test("a matching catalogue prefix needs initialization without a blocker", async () => {
    const { local, rpc, catalogue } = fixture();
    catalogue.initialized = 128;
    catalogue.digest = realmCatalogueDigest(128);
    const plan = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    expect(plan.synced).toBe(false);
    expect(plan.blockers).toEqual([]);
    expect(plan.realmCatalogue).toEqual(catalogue);
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
  test("logic release and authority mismatches block before transactions", async () => {
    const { local, rpc, state } = fixture();
    state.authority = "0x42";
    state.classes.map = "0x55";
    const plan = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    expect(plan.synced).toBe(false);
    expect(plan.blockers).toContain("Games authority mismatch");
    expect(plan.blockers).toContain("Games initial logic release mismatch");
    await expect(deployNativeWorld(local, rpc as unknown as Account, () => {})).rejects.toThrow("mismatch");
  });

  test("a different Games class cannot replace the immutable deployment", async () => {
    const { local, rpc, state } = fixture();
    state.gamesClassHash = "0x456";
    await expect(deployNativeWorld(local, rpc as unknown as Account, () => {})).rejects.toThrow("Games is immutable");
  });
});
