import { afterEach, describe, expect, test } from "bun:test";
import { type Account, type RpcProvider } from "starknet";
import schemaJson from "../../../../../contracts/l3/world-native/schema/schema.json";
import { canonicalRealmTraits, realmCatalogueDigest } from "./realm-catalogue";
import { loadNativeWorld } from "./artifacts";
import { inspectNativeWorld } from "./plan";
import { deployNativeWorld } from "./deploy";
import { applyNativeRelease, registerNativeRelease } from "./releases";
import { buildNativeManifest } from "./manifest";
import type { NativeWorld } from "./types";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
function serveHerald(local: NativeWorld, releaseSchemas: Record<string, string>): void {
  globalThis.fetch = (async (url: string) => {
    expect(url).toBe("https://herald.test/manifest");
    return new Response(JSON.stringify({ chainId: "0x1", contracts: { games: local.games.address }, releaseSchemas }));
  }) as typeof fetch;
}

const authentication = { submitter: "0x99", account_class: "0x77", guardian_public_key: "0x88" };
function fixture() {
  const logic = Object.keys(schemaJson.logicClasses).map((name) => ({ name, classHash: "0x123", sierra: { abi: [] } }));
  const local = {
    seed: "native-test",
    authority: "0x99",
    authentication,
    schema: schemaJson,
    logic,
    release: {
      releaseId: 1,
      schema: schemaJson.identity,
      migrationClassHash: "0x0",
      classes: {
        games: "0x123",
        logic: Object.fromEntries(logic.map(({ name, classHash }) => [name, classHash])),
        account: authentication.account_class,
      },
    },
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
    releases: new Map([[1, { classes: structuredClone(local.release.classes.logic), migration: "0x0" }]]),
    gamesClassHash: "0x123",
    releaseId: 1,
    gamePins: new Map([
      [7, 1],
      [8, 1],
    ]),
    declared: new Set(["0x123"]),
    authentication: { ...authentication },
    applied: [] as Array<[number, number]>,
    operations: [] as string[],
  };
  const catalogue = {
    initialized: canonicalRealmTraits.length,
    digest: realmCatalogueDigest(canonicalRealmTraits.length),
  };
  const rpc = {
    getBlockNumber: async () => 10,
    getClass: async (classHash: string) => {
      if (!state.declared.has(classHash)) throw { code: 28 };
      return {};
    },
    getClassHashAt: async () => state.gamesClassHash,
    callContract: async ({ entrypoint, calldata = [] }: { entrypoint: string; calldata?: string[] }) => {
      if (entrypoint === "deployment_configuration") return [state.authority];
      if (entrypoint === "current_release") return [String(state.releaseId)];
      if (entrypoint === "game_release") return [String(state.gamePins.get(Number(calldata[0])))];
      if (entrypoint === "release") {
        const release = state.releases.get(Number(calldata[0]));
        if (!release) throw new Error("unknown release");
        return [...Object.keys(schemaJson.logicClasses).map((name) => release.classes[name]), release.migration];
      }
      if (entrypoint === "realm_catalogue") return [String(catalogue.initialized), catalogue.digest];
      if (entrypoint === "authentication")
        return [
          state.authentication.submitter,
          state.authentication.account_class,
          state.authentication.guardian_public_key,
        ];
      throw new Error(`Unexpected view ${entrypoint}`);
    },
    declare: async ({ classHash }: { classHash: string }) => {
      state.operations.push(`declare:${classHash}`);
      state.declared.add(classHash);
      return { transaction_hash: "0x321" };
    },
    execute: async ({ entrypoint, calldata }: { entrypoint: string; calldata: string[] }) => {
      state.operations.push(entrypoint);
      if (entrypoint === "register_release") {
        const id = Number(calldata[0]);
        state.releases.set(id, {
          classes: Object.fromEntries(
            Object.keys(schemaJson.logicClasses).map((name, index) => [name, calldata[index + 1]]),
          ),
          migration: calldata[Object.keys(schemaJson.logicClasses).length + 1],
        });
        state.releaseId = id;
      } else if (entrypoint === "set_authentication") {
        if (BigInt(calldata[1]) !== BigInt(state.authentication.account_class))
          throw new Error("immutable account class");
        state.authentication.submitter = calldata[0];
      } else if (entrypoint === "apply_release") {
        const gameId = Number(calldata[0]);
        const releaseId = Number(calldata[1]);
        if (releaseId !== state.gamePins.get(gameId)! + 1) throw new Error("release must follow game pin");
        state.gamePins.set(gameId, releaseId);
        state.applied.push([gameId, releaseId]);
      } else throw new Error(`Unexpected transaction ${entrypoint}`);
      return { transaction_hash: "0x321" };
    },
    getTransactionStatus: async () => ({ finality_status: "ACCEPTED_ON_L2" }),
    getTransactionReceipt: async () => ({ execution_status: "SUCCEEDED", block_number: 10 }),
  };
  local.previous = buildNativeManifest(local, { blockNumber: 10 } as never, {
    chainId: "0x1",
    accountClassHash: "0x77",
    contracts: {},
    guardianPublicKey: "0x99",
  });
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
        release: fixture().local.release,
        previous: { world: { seed: "old-release" } } as never,
      }),
    ).toThrow("Games requires a fresh deployment");
  });
  test("a different seed cannot deploy a second Games beside a native manifest", () => {
    const { local } = fixture();
    expect(() =>
      loadNativeWorld({
        artifacts: "missing",
        schemaPath: "missing",
        seed: "native-other",
        authority: local.authority,
        authentication,
        release: local.release,
        previous: local.previous,
      }),
    ).toThrow("seed native-test; native-other is refused");
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
    state.releases.get(1)!.classes.map = "0x55";
    const plan = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    expect(plan.synced).toBe(false);
    expect(plan.blockers).toContain("Games authority mismatch");
    expect(plan.blockers).toContain("Release is immutable; registered contents differ from release facts");
    await expect(deployNativeWorld(local, rpc as unknown as Account, () => {})).rejects.toThrow("mismatch");
  });

  test("a new submitter is rotated by the authority, while the account class and guardian stay fixed", async () => {
    const { local, rpc, state } = fixture();
    local.authentication = { ...authentication, submitter: "0x55" };
    const plan = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    expect(plan.blockers).toEqual([]);
    expect(plan.submitterRotation).toEqual({ from: "0x99", to: "0x55" });
    expect(plan.synced).toBe(false);
    const transactions: string[] = [];
    const report = await deployNativeWorld(local, rpc as unknown as Account, ({ action }) => transactions.push(action));
    expect(transactions).toEqual(["set_authentication"]);
    expect(BigInt(state.authentication.submitter)).toBe(0x55n);
    expect(report.after.synced).toBe(true);
    expect(report.after.worldAddress).toBe("0x1");

    for (const fixed of [{ account_class: "0x66" }, { guardian_public_key: "0x66" }]) {
      local.authentication = { ...authentication, submitter: "0x55", ...fixed };
      await expect(
        deployNativeWorld(local, rpc as unknown as Account, () => {
          throw new Error("unexpected transaction");
        }),
      ).rejects.toThrow("the account class and guardian are fixed");
    }
  });

  test("a different Games class cannot replace the immutable deployment", async () => {
    const { local, rpc, state } = fixture();
    state.gamesClassHash = "0x456";
    await expect(deployNativeWorld(local, rpc as unknown as Account, () => {})).rejects.toThrow("Games is immutable");
  });

  test("a hotfix registers once, preserves the Games address, and only applies to explicitly chosen games", async () => {
    const { local, rpc, state } = fixture();
    const shard = { chainId: "0x1", accountClassHash: "0x77", contracts: {}, guardianPublicKey: "0x99" };
    local.previous = buildNativeManifest(local, await inspectNativeWorld(local, rpc as unknown as RpcProvider), shard);
    local.release.releaseId = 2;
    local.release.classes.logic.movement = "0x456";
    local.logic.find(({ name }) => name === "movement")!.classHash = "0x456";
    const transactions: string[] = [];
    const submitted = ({ action }: { action: string }) => transactions.push(action);
    const first = await deployNativeWorld(local, rpc as unknown as Account, submitted);
    expect(first.after.synced).toBe(true);
    expect(first.after.worldAddress).toBe("0x1");
    expect(transactions).toEqual(["declare", "register_release"]);
    expect(BigInt(state.releases.get(1)!.classes.movement)).toBe(0x123n);
    expect(BigInt(state.releases.get(2)!.classes.movement)).toBe(0x456n);
    expect(state.gamePins.get(7)).toBe(1);
    const published = buildNativeManifest(local, first.before, shard);
    expect(published.native.releaseSchemas).toEqual({
      "1": local.previous.native.activeSchema,
      "2": local.release.schema,
    });
    serveHerald(local, { "1": local.release.schema, "2": local.release.schema });
    await applyNativeRelease(local, rpc as unknown as Account, [7], "https://herald.test", submitted);
    expect(transactions).toEqual(["declare", "register_release", "apply_release"]);
    transactions.length = 0;
    await deployNativeWorld(local, rpc as unknown as Account, submitted);
    await applyNativeRelease(local, rpc as unknown as Account, [7], "https://herald.test", submitted);
    expect(transactions).toEqual([]);
  });
  test("a schema-changing hotfix is refused before reading artifacts or sending transactions", async () => {
    const { local, rpc } = fixture();
    local.release.schema = "changed-schema";
    expect(() =>
      loadNativeWorld({
        artifacts: "missing",
        schemaPath: "missing",
        seed: local.seed,
        authority: local.authority,
        authentication,
        release: local.release,
        previous: local.previous,
      }),
    ).toThrow("NATIVE_HOTFIX_SCHEMA_CHANGE");
    await expect(
      deployNativeWorld(local, rpc as unknown as Account, () => {
        throw new Error("unexpected transaction");
      }),
    ).rejects.toThrow("NATIVE_HOTFIX_SCHEMA_CHANGE");
  });

  test("each release keeps its own classes and changed contents under the same id are refused", async () => {
    const { local, rpc, state } = fixture();
    const original = structuredClone(state.releases.get(1));
    local.release.releaseId = 2;
    local.release.classes.logic.movement = "0x456";
    local.logic.find(({ name }) => name === "movement")!.classHash = "0x456";
    await deployNativeWorld(local, rpc as unknown as Account, () => {});
    expect(state.releases.get(1)).toEqual(original);
    expect(BigInt(state.releases.get(2)!.classes.movement)).toBe(0x456n);
    local.release.classes.logic.movement = "0x789";
    local.logic.find(({ name }) => name === "movement")!.classHash = "0x789";
    await expect(deployNativeWorld(local, rpc as unknown as Account, () => {})).rejects.toThrow("Release is immutable");
  });

  test("registration refuses an undeclared migration before sending a transaction", async () => {
    const { local, rpc, state } = fixture();
    local.release.releaseId = 2;
    local.release.migrationClassHash = "0x456";
    await expect(registerNativeRelease(local, rpc as unknown as Account, () => {})).rejects.toThrow(
      "NATIVE_MIGRATION_NOT_DECLARED",
    );
    expect(state.operations).toEqual([]);
    expect(state.releaseId).toBe(1);
  });

  test("the migration artifact is declared before its release is registered", async () => {
    const { local, rpc, state } = fixture();
    local.release.releaseId = 2;
    local.release.migrationClassHash = "0x456";
    local.migration = { name: "migration", classHash: "0x456", sierra: { abi: [] } } as never;
    const plan = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    expect(plan.classes.find(({ name }) => name === "migration")?.declared).toBe(false);
    await deployNativeWorld(local, rpc as unknown as Account, () => {});
    expect(state.operations).toEqual(["declare:0x456", "register_release"]);
    expect(BigInt(state.releases.get(2)!.migration)).toBe(0x456n);
  });

  test("apply refuses unregistered or unpublished releases and walks every migration in order", async () => {
    const { local, rpc, state } = fixture();
    local.release.releaseId = 2;
    await expect(
      applyNativeRelease(local, rpc as unknown as Account, [7], "https://herald.test", () => {}),
    ).rejects.toThrow("NATIVE_RELEASE_NOT_REGISTERED");
    await deployNativeWorld(local, rpc as unknown as Account, () => {});
    local.release.releaseId = 3;
    await deployNativeWorld(local, rpc as unknown as Account, () => {});
    serveHerald(local, { "1": local.release.schema, "3": local.release.schema });
    await expect(
      applyNativeRelease(local, rpc as unknown as Account, [7, 8], "https://herald.test", () => {}),
    ).rejects.toThrow("publish release 2 to Herald");
    expect(state.applied).toEqual([]);
    serveHerald(local, { "1": local.release.schema, "2": local.release.schema, "3": local.release.schema });
    await applyNativeRelease(local, rpc as unknown as Account, [7, 8], "https://herald.test", () => {});
    expect(state.applied).toEqual([
      [7, 2],
      [7, 3],
      [8, 2],
      [8, 3],
    ]);
    await applyNativeRelease(local, rpc as unknown as Account, [7, 8], "https://herald.test", () => {});
    expect(state.applied).toHaveLength(4);
  });
});
