import { describe, expect, test } from "bun:test";
import { type Account, type RpcProvider } from "starknet";
import schemaJson from "../../../../../contracts/l3/world-native/schema/schema.json";
import { canonicalRealmTraits, realmCatalogueDigest } from "./realm-catalogue";
import { assertBalanceSince, assertFamilyLogicReturned, loadNativeWorld } from "./artifacts";
import { inspectNativeWorld } from "./plan";
import { deployNativeWorld } from "./deploy";
import { registerNativeRelease } from "./releases";
import { buildNativeManifest } from "./manifest";
import type { NativeWorld } from "./types";
import { nativeBalanceIdentity } from "../../../../../contracts/l3/world-native/schema/balance.gen";
import { nativeIdentifiers } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { blitzPendingCommands } from "../../../../source/common/native-commands";
import { NATIVE_RELEASES } from "../../../../../deploy/release/native-release";

const authentication = { account_class: "0x77", guardian_public_key: "0x88" };
const slotOf = (name: string) => schemaJson.logicClasses.findIndex((logic) => logic.name === name);
const catalogueDigest = realmCatalogueDigest(canonicalRealmTraits.length);
function fixture() {
  const logic = schemaJson.logicClasses.map(({ name }) => ({ name, classHash: "0x123", sierra: { abi: [] } }));
  const local = {
    seed: "native-test",
    authority: "0x99",
    authentication,
    launcher: "0x99",
    ledgerOperator: "0x99",
    vrfPublicKey: { x: "0x1", y: "0x2" },
    l2GasBound: "0x47868c00",
    verifier: { name: "verifier", classHash: "0x123", sierra: { abi: [] } },
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
        verifier: "0x123",
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
    launcher: local.launcher,
    ledger: local.ledgerOperator,
    key: local.vrfPublicKey,
    bound: local.l2GasBound,
    releases: new Map([
      [1, { family: 1, previous: 0, classes: logic.map(({ classHash }) => classHash), migration: "0x0" }],
    ]),
    gamesClassHash: "0x123",
    gamePins: new Map([
      [7, 1],
      [8, 1],
    ]),
    declared: new Set(["0x123"]),
    authentication: { ...authentication },
    operations: [] as string[],
  };
  const catalogue = {
    initialized: canonicalRealmTraits.length,
    digest: catalogueDigest,
  };
  const rpc = {
    getBlockNumber: async () => 10,
    getClass: async (classHash: string) => {
      if (!state.declared.has(classHash)) throw { code: 28 };
      return {};
    },
    getClassHashAt: async () => state.gamesClassHash,
    callContract: async ({ entrypoint, calldata = [] }: { entrypoint: string; calldata?: string[] }) => {
      if (entrypoint === "owner") return [state.authority];
      if (entrypoint === "launcher") return [state.launcher];
      if (entrypoint === "ledger_operator") return [state.ledger];
      if (entrypoint === "vrf_public_key") return [state.key.x, state.key.y];
      if (entrypoint === "l2_gas_bound") return [state.bound];
      if (entrypoint === "release_registered") return [state.releases.has(Number(calldata[0])) ? "0x1" : "0x0"];
      if (entrypoint === "release") {
        const release = state.releases.get(Number(calldata[0]));
        if (!release) throw new Error("unknown release");
        return [String(release.family), String(release.previous), String(release.classes.length), release.migration];
      }
      if (entrypoint === "release_classes") {
        const release = state.releases.get(Number(calldata[0]));
        if (!release) throw new Error("unknown release");
        return [String(release.classes.length), ...release.classes];
      }
      if (entrypoint === "latest_release_of") return [String(Math.max(0, ...[...state.releases.keys()]))];
      if (entrypoint === "realm_catalogue") return [String(catalogue.initialized), catalogue.digest];
      if (entrypoint === "authentication")
        return [state.authentication.account_class, state.authentication.guardian_public_key];
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
        const [id, family, previous, slotCount, migration, count, ...classes] = calldata;
        if (Number(slotCount) !== classes.length || Number(count) !== classes.length)
          throw new Error("slot count is not the class count");
        state.releases.set(Number(id), {
          family: Number(family),
          previous: Number(previous),
          classes,
          migration: migration!,
        });
      } else if (entrypoint === "set_launcher") {
        state.launcher = calldata[0]!;
      } else if (entrypoint === "set_ledger_operator") {
        state.ledger = calldata[0]!;
      } else throw new Error(`Unexpected transaction ${entrypoint}`);
      return { transaction_hash: "0x321" };
    },
    getTransactionStatus: async () => ({ finality_status: "ACCEPTED_ON_L2" }),
    getTransactionReceipt: async () => ({ execution_status: "SUCCEEDED", block_number: 10 }),
  };
  local.previous = buildNativeManifest(
    local,
    {
      before: { blockNumber: 10 } as never,
      after: { releases: { "1": { schema: local.release.schema, family: 1, previous: 0 } } } as never,
    },
    {
      chainId: "0x1",
      accountClassHash: "0x77",
      contracts: {},
      guardianPublicKey: "0x99",
      l2GasBound: "0x47868c00",
      vrfPublicKey: { x: "0x1", y: "0x2" },
    },
  );
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
        launcher: "0x99",
        ledgerOperator: "0x99",
        vrfPublicKey: { x: "0x1", y: "0x2" },
        l2GasBound: "0x47868c00",
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
        launcher: "0x99",
        ledgerOperator: "0x99",
        vrfPublicKey: { x: "0x1", y: "0x2" },
        l2GasBound: "0x47868c00",
        release: local.release,
        previous: local.previous,
      }),
    ).toThrow("seed native-test; native-other is refused");
  });
  test("a manifest that lists release schemas without their families is refused", () => {
    const { local } = fixture();
    const { releases, ...native } = local.previous!.native;
    expect(() =>
      loadNativeWorld({
        artifacts: "missing",
        schemaPath: "missing",
        seed: local.seed,
        authority: local.authority,
        authentication,
        launcher: "0x99",
        ledgerOperator: "0x99",
        vrfPublicKey: { x: "0x1", y: "0x2" },
        l2GasBound: "0x47868c00",
        release: local.release,
        previous: {
          ...local.previous!,
          native: { ...native, releaseSchemas: { "1": releases["1"]!.schema } },
        } as never,
      }),
    ).toThrow("lists no releases with their families");
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
    state.releases.get(1)!.classes[slotOf("map")] = "0x55";
    const plan = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    expect(plan.synced).toBe(false);
    expect(plan.blockers).toContain("Games authority mismatch");
    expect(plan.blockers).toContain("Release is immutable; registered contents differ from release facts");
    await expect(deployNativeWorld(local, rpc as unknown as Account, () => {})).rejects.toThrow("mismatch");
  });

  test("bootstrap initializes only an unset ledger role and preserves the constructor launcher", async () => {
    const { local, rpc, state } = fixture();
    state.ledger = "0x0";
    local.launcher = "0x55";
    const plan = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    expect(plan.blockers).toEqual([]);
    expect(plan.roleChanges).toEqual([{ entrypoint: "set_ledger_operator", address: local.ledgerOperator }]);
    const actions: string[] = [];
    const report = await deployNativeWorld(local, rpc as unknown as Account, ({ action }) => actions.push(action));
    expect(actions).toEqual(["set_ledger_operator"]);
    expect(report.after.synced).toBe(true);
    expect(state.launcher).toBe("0x99");
    expect(state.ledger).toBe(local.ledgerOperator);
    for (const fixed of [{ account_class: "0x66" }, { guardian_public_key: "0x66" }]) {
      local.authentication = { ...authentication, ...fixed };
      await expect(
        deployNativeWorld(local, rpc as unknown as Account, () => {
          throw new Error("unexpected transaction");
        }),
      ).rejects.toThrow("the account class and guardian are fixed");
    }
    local.authentication = authentication;
    local.vrfPublicKey = { x: "0x3", y: "0x4" };
    await expect(deployNativeWorld(local, rpc as unknown as Account, () => {})).rejects.toThrow("VRF key is immutable");
    local.vrfPublicKey = state.key;
    local.l2GasBound = "0x1";
    await expect(deployNativeWorld(local, rpc as unknown as Account, () => {})).rejects.toThrow(
      "gas bound is immutable",
    );
  });

  test("a redeploy without local history never takes service roles back to bootstrap", async () => {
    const { local, rpc, state } = fixture();
    delete local.previous;
    state.launcher = "0x55";
    state.ledger = "0x66";
    const report = await deployNativeWorld(local, rpc as unknown as Account, () => {
      throw new Error("unexpected transaction");
    });
    expect(report.before.roleChanges).toEqual([]);
    expect(report.after.synced).toBe(true);
    expect(state.launcher).toBe("0x55");
    expect(state.ledger).toBe("0x66");
    expect(state.operations).toEqual([]);
  });

  test("a different Games class cannot replace the immutable deployment", async () => {
    const { local, rpc, state } = fixture();
    state.gamesClassHash = "0x456";
    await expect(deployNativeWorld(local, rpc as unknown as Account, () => {})).rejects.toThrow("Games is immutable");
  });

  test("a release the chain registered after the manifest was last written is copied from its own release row", async () => {
    const { local, rpc, state } = fixture();
    const shard = {
      chainId: "0x1",
      accountClassHash: "0x77",
      contracts: {},
      guardianPublicKey: "0x99",
      l2GasBound: "0x47868c00",
      vrfPublicKey: { x: "0x1", y: "0x2" },
    };
    const synced = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    local.previous = buildNativeManifest(local, { before: synced, after: synced }, shard);
    state.releases.set(2, { ...structuredClone(state.releases.get(1)!), previous: 1 });
    local.release.releaseId = 3;
    local.release.classes.logic.movement = "0x456";
    local.logic.find(({ name }) => name === "movement")!.classHash = "0x456";
    const report = await deployNativeWorld(local, rpc as unknown as Account, () => {});
    expect(buildNativeManifest(local, report, shard).native.releases).toEqual({
      "1": { schema: local.release.schema, family: 1, previous: 0 },
      "2": { schema: local.release.schema, family: 1, previous: 1 },
      "3": { schema: local.release.schema, family: 1, previous: 2 },
    });
  });

  test("a hotfix registers once, preserves the Games address, and leaves every game on its pin", async () => {
    const { local, rpc, state } = fixture();
    const shard = {
      chainId: "0x1",
      accountClassHash: "0x77",
      contracts: {},
      guardianPublicKey: "0x99",
      l2GasBound: "0x47868c00",
      vrfPublicKey: { x: "0x1", y: "0x2" },
    };
    const synced = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    local.previous = buildNativeManifest(local, { before: synced, after: synced }, shard);
    local.release.releaseId = 2;
    local.release.classes.logic.movement = "0x456";
    local.logic.find(({ name }) => name === "movement")!.classHash = "0x456";
    const transactions: string[] = [];
    const submitted = ({ action }: { action: string }) => transactions.push(action);
    const first = await deployNativeWorld(local, rpc as unknown as Account, submitted);
    expect(first.after.synced).toBe(true);
    expect(first.after.worldAddress).toBe("0x1");
    expect(transactions).toEqual(["declare", "register_release"]);
    expect(state.releases.get(2)).toMatchObject({ family: 1, previous: 1 });
    expect(BigInt(state.releases.get(1)!.classes[slotOf("movement")]!)).toBe(0x123n);
    expect(BigInt(state.releases.get(2)!.classes[slotOf("movement")]!)).toBe(0x456n);
    expect(state.gamePins.get(7)).toBe(1);
    const published = buildNativeManifest(local, first, shard);
    expect(published.native.releases).toEqual({
      "1": { schema: local.previous.native.activeSchema, family: 1, previous: 0 },
      "2": { schema: local.release.schema, family: 1, previous: 1 },
    });
    expect(published.native.releaseBalances).toEqual({ "1": nativeBalanceIdentity, "2": nativeBalanceIdentity });
    transactions.length = 0;
    await deployNativeWorld(local, rpc as unknown as Account, submitted);
    expect(transactions).toEqual([]);
    expect(state.gamePins.get(7)).toBe(1);
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
        launcher: "0x99",
        ledgerOperator: "0x99",
        vrfPublicKey: { x: "0x1", y: "0x2" },
        l2GasBound: "0x47868c00",
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

  test("a release whose earlier releases ran other balance numbers is refused until it says its numbers start with it", async () => {
    const { local, rpc } = fixture();
    const shard = {
      chainId: "0x1",
      accountClassHash: "0x77",
      contracts: {},
      guardianPublicKey: "0x99",
      l2GasBound: "0x47868c00",
      vrfPublicKey: { x: "0x1", y: "0x2" },
    };
    const since = NATIVE_RELEASES.frontier.since;
    const other = "0".repeat(64);
    const synced = await inspectNativeWorld(local, rpc as unknown as RpcProvider);
    local.previous = buildNativeManifest(local, { before: synced, after: synced }, shard);
    local.release.releaseId = since + 1;
    local.previous.native.releaseBalances = { [since]: other };
    await expect(
      deployNativeWorld(local, rpc as unknown as Account, () => {
        throw new Error("unexpected transaction");
      }),
    ).rejects.toThrow(
      `NATIVE_BALANCE_SINCE: release ${since} runs other balance numbers; set NATIVE_RELEASES.frontier.since to ${since + 1}`,
    );
    const accepted = (releaseBalances: Record<string, string> | undefined, releaseId = since + 1) =>
      expect(() =>
        assertBalanceSince(
          { ...local.release, releaseId },
          { ...local.previous!, native: { ...local.previous!.native, releaseBalances } },
        ),
      ).not.toThrow();
    accepted({ [since]: nativeBalanceIdentity });
    accepted({ [since - 1]: other });
    accepted({ [since]: other }, since);
    accepted(undefined);
  });

  test("each release keeps its own classes and changed contents under the same id are refused", async () => {
    const { local, rpc, state } = fixture();
    const original = structuredClone(state.releases.get(1));
    local.release.releaseId = 2;
    local.release.classes.logic.movement = "0x456";
    local.logic.find(({ name }) => name === "movement")!.classHash = "0x456";
    await deployNativeWorld(local, rpc as unknown as Account, () => {});
    expect(state.releases.get(1)).toEqual(original);
    expect(BigInt(state.releases.get(2)!.classes[slotOf("movement")]!)).toBe(0x456n);
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
    expect(state.releases.has(2)).toBe(false);
  });

  test("a release registers its classes in the slot order of the generated schema", async () => {
    const { local, rpc, state } = fixture();
    local.release.releaseId = 2;
    for (const [slot, logic] of local.logic.entries()) logic.classHash = `0x${(0x1000 + slot).toString(16)}`;
    local.release.classes.logic = Object.fromEntries(
      local.logic.map(({ name, classHash }) => [name, classHash]).reverse(),
    );
    await registerNativeRelease(local, rpc as unknown as Account, () => {});
    expect(state.releases.get(2)!.classes.map(BigInt)).toEqual(
      schemaJson.logicClasses.map(({ name }) => BigInt(local.release.classes.logic[name]!)),
    );
  });

  test("a release older than one the shard registered, opened or not, and a skipped release are blocked", async () => {
    const { local, rpc, state } = fixture();
    state.releases.set(2, structuredClone(state.releases.get(1)!));
    expect((await inspectNativeWorld(local, rpc as unknown as RpcProvider)).blockers).toContain(
      "Cannot redeploy an older release over a newer registered release",
    );
    local.release.releaseId = 4;
    expect((await inspectNativeWorld(local, rpc as unknown as RpcProvider)).blockers).toContain(
      "Release must follow the latest registered release",
    );
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
});

test("a Blitz release is refused while a Blitz command waits for its logic", () => {
  expect(() => assertFamilyLogicReturned(nativeIdentifiers.family.BLITZ)).toThrow(
    `NATIVE_BLITZ_PENDING: the Blitz logic has not returned for ${blitzPendingCommands.join(", ")}`,
  );
  expect(() => assertFamilyLogicReturned(nativeIdentifiers.family.FRONTIER)).not.toThrow();
  expect(Object.keys(NATIVE_RELEASES)).not.toContain("blitz");
});
