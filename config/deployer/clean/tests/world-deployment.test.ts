import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CallData, hash, type Account } from "starknet";
import { byteArrayHash, readWorldProfile, resourceSelector } from "../world/artifacts";
import { deployWorld, isWorldSynced } from "../world/deploy";
import { buildWorldManifest } from "../world/manifest";
import { inspectWorld } from "../world/plan";
import type { LocalResource, LocalWorld } from "../world/types";

// The tracked deployment ABI is an independent contract boundary for encoded calls.
const deployed = JSON.parse(
  readFileSync(resolve(import.meta.dir, "../../../../contracts/l3/game/manifest_madara.json"), "utf8"),
);
const abi = deployed.world.abi;
const codec = new CallData(abi);
const normalized = (value: string | bigint) => `0x${BigInt(value).toString(16)}`;

function fixture() {
  const profile = {
    namespace: { default: "s2" },
    world: { seed: "test", name: "test" },
    lib_versions: { "s2-lib": "1" },
    env: { rpc_url: "unused", account_address: "0x1", private_key: "unused" },
    writers: { s2: ["s2-system"] },
  };
  const artifact = { classHash: "0x100", compiledClassHash: "0x101", sierra: { abi }, casm: {} } as LocalWorld["world"];
  const resources = ["library", "model", "event", "contract"].map((kind, index) => {
    const name = ["lib", "Model", "Event", "system"][index];
    const tag = `s2-${name}${kind === "library" ? "_v1" : ""}`;
    return {
      ...artifact,
      classHash: `0x${200 + index}`,
      kind,
      name,
      tag,
      namespace: "s2",
      selector: resourceSelector("s2", tag.slice(3)),
      version: kind === "library" ? "1" : undefined,
      initCalldata: ["9", "10"],
      systems: [],
      members: [],
    } as LocalResource;
  });
  const local: LocalWorld = {
    profile,
    world: artifact,
    resources,
    address: hash.calculateContractAddressFromHash("0x12", artifact.classHash, [], 0),
    salt: "0x12",
  };
  const classes = new Map<string, string>();
  const declared = new Set<string>();
  const initialized = new Set<string>();
  const state = new Map<string, string[]>();
  const writers = new Set<string>();
  const writes: Array<{ kind: string; args: any }> = [];
  let tx = 0;
  const account = {
    getBlockNumber: async () => 42,
    getClass: async (value: string) => {
      if (!declared.has(value)) throw { code: 28 };
      return {};
    },
    getClassHashAt: async (address: string) => {
      if (!classes.has(address)) throw { code: 20 };
      return classes.get(address)!;
    },
    getEvents: async () => ({
      events: [...initialized].map((selector) => ({
        keys: [hash.getSelectorFromName("ContractInitialized"), selector],
        data: [],
      })),
    }),
    callContract: async (call: any) =>
      call.entrypoint === "resource"
        ? (state.get(normalized(call.calldata[0])) ?? ["5"])
        : [writers.has(call.calldata.map(normalized).join(":")) ? "1" : "0"],
    declare: async (args: any) => {
      writes.push({ kind: "declare", args });
      declared.add(args.classHash);
      return { transaction_hash: `0x${++tx}` };
    },
    deployContract: async (args: any) => {
      writes.push({ kind: "deploy", args });
      classes.set(local.address, args.classHash);
      return { contract_address: local.address, transaction_hash: `0x${++tx}` };
    },
    waitForTransaction: async () => ({ isSuccess: () => true }),
    execute: async (call: any) => {
      const args = codec.decodeParameters(
        (
          abi.find((e: any) => e.type === "interface" && e.items.some((i: any) => i.name === call.entrypoint)) as any
        ).items
          .find((i: any) => i.name === call.entrypoint)
          .inputs.map((i: any) => i.type),
        call.calldata,
      );
      writes.push({ kind: call.entrypoint, args });
      if (call.entrypoint === "register_namespace") state.set(byteArrayHash("s2"), ["3"]);
      else if (call.entrypoint === "grant_writer") writers.add(call.calldata.map(normalized).join(":"));
      else if (call.entrypoint === "init_contract") initialized.add(normalized(call.calldata[0]));
      else {
        const resource = local.resources.find((r) =>
          call.calldata.some((value: string) => BigInt(value) === BigInt(r.classHash)),
        )!;
        const address =
          resource.kind === "contract"
            ? hash.calculateContractAddressFromHash(resource.selector, resource.classHash, [], local.address)
            : `0x${300 + local.resources.indexOf(resource)}`;
        const existing = state.get(resource.selector);
        const resolvedAddress = call.entrypoint.startsWith("upgrade") ? existing![1] : address;
        state.set(resource.selector, [
          String({ model: 0, event: 1, contract: 2, library: 6 }[resource.kind]),
          resource.kind === "library" ? resource.classHash : resolvedAddress,
          byteArrayHash("s2"),
        ]);
        classes.set(resolvedAddress, resource.classHash);
      }
      return { transaction_hash: `0x${++tx}` };
    },
  } as unknown as Account;
  return { local, account, writes, classes, state, declared, initialized };
}

describe("world deployment", () => {
  test("registers the library versions used by Cairo dispatchers", () => {
    const game = resolve(import.meta.dir, "../../../../contracts/l3/game");
    const profile = readWorldProfile(resolve(game, "dojo_madara.toml"));
    const versions: Record<string, string> = {};
    for (const file of new Bun.Glob("**/*.cairo").scanSync(resolve(game, "src/system_libraries"))) {
      const source = readFileSync(resolve(game, "src/system_libraries", file), "utf8");
      for (const match of source.matchAll(/world\.dns\(@"([^"]+)_v([^"]+)"\)/g)) {
        versions[`${profile.namespace.default}-${match[1]}`] = match[2]!;
      }
    }
    expect(Object.keys(versions).length).toBeGreaterThan(0);
    expect(profile.lib_versions).toEqual(versions);
  });

  test("matches existing resource selectors and namespace hashing", () => {
    for (const resource of [...deployed.models, ...deployed.events, ...deployed.contracts, ...deployed.libraries]) {
      expect(
        resourceSelector(
          "s2",
          resource.version ? resource.tag.slice(3, -(resource.version.length + 2)) : resource.tag.slice(3),
        ),
      ).toBe(resource.selector);
    }
  });

  test("declares explicit compiled hashes, registers, grants writers, initializes, then converges without writes", async () => {
    const { local, account, writes } = fixture();
    const first = await deployWorld(local, account, () => {});
    expect(isWorldSynced(first.after)).toBe(true);
    expect(
      writes.filter((write) => write.kind === "declare").every((write) => write.args.compiledClassHash === "0x101"),
    ).toBe(true);
    expect(writes.findIndex((write) => write.kind === "grant_writer")).toBeLessThan(
      writes.findIndex((write) => write.kind === "init_contract"),
    );
    const count = writes.length;
    const second = await deployWorld(local, account, () => {});
    expect(second.transactions).toEqual([]);
    expect(writes).toHaveLength(count);
    const manifest = buildWorldManifest(local, second.after);
    expect(Object.keys(manifest).sort()).toEqual(Object.keys(deployed).sort());
    expect(manifest.world.abi).toEqual(abi);
    expect(manifest.contracts[0].init_calldata).toEqual(["9", "10"]);
  });

  test("preserves the existing manifest precedence for repeated ABI helper names", async () => {
    const { local, account } = fixture();
    const plan = await inspectWorld(local, account);
    local.resources = [...local.resources].sort((a, b) => a.tag.localeCompare(b.tag));
    for (const resource of local.resources) {
      resource.sierra = {
        ...resource.sierra,
        abi: [
          {
            type: "function",
            name: "ensure_abi",
            inputs: [{ name: "row", type: resource.kind }],
            outputs: [],
            state_mutability: "view",
          },
        ],
      };
    }
    const manifest = buildWorldManifest(local, plan);
    expect(manifest.abis.find((entry) => entry.name === "ensure_abi")).toEqual(
      local.resources.find((resource) => resource.kind === "library")!.sierra.abi[0],
    );
  });

  test("blocks an existing library version with a different hash before declaring anything", async () => {
    const { local, account, writes, state } = fixture();
    await deployWorld(local, account, () => {});
    state.get(local.resources[0].selector)![1] = "0x999";
    const count = writes.length;
    await expect(deployWorld(local, account, () => {})).rejects.toThrow("is immutable");
    expect(writes).toHaveLength(count);
  });

  test("inspects changes without signing and preserves addresses and initialization during upgrades", async () => {
    const { local, account, writes } = fixture();
    await deployWorld(local, account, () => {});
    const old = await inspectWorld(local, account);
    local.resources[3].classHash = "0x888";
    const count = writes.length;
    expect((await inspectWorld(local, account)).resources.find((r) => r.kind === "contract")?.action).toBe("upgrade");
    expect(writes).toHaveLength(count);
    const updated = await deployWorld(local, account, () => {});
    expect(updated.after.resources.find((r) => r.kind === "contract")?.address).toBe(
      old.resources.find((r) => r.kind === "contract")?.address,
    );
    expect(updated.transactions.map((t) => t.action)).toEqual(["declare", "upgrade_contract"]);
  });

  test("resumes a registered contract whose initialization transaction never completed", async () => {
    const { local, account, initialized } = fixture();
    await deployWorld(local, account, () => {});
    initialized.clear();
    const resumed = await deployWorld(local, account, () => {});
    expect(resumed.transactions.map((t) => t.action)).toEqual(["init_contract"]);
  });

  test("rejects a nonexistent explicit address before declaring classes", async () => {
    const { local, account, writes } = fixture();
    local.address = "0x999";
    await expect(deployWorld(local, account, () => {})).rejects.toThrow("seed-derived address");
    expect(writes).toEqual([]);
  });

  test("stops at a reverted transaction instead of reporting a successful deployment", async () => {
    const { local, account, writes } = fixture();
    account.waitForTransaction = async () => ({ isSuccess: () => false }) as any;
    const submitted: string[] = [];
    await expect(deployWorld(local, account, (record) => submitted.push(record.hash))).rejects.toThrow("failed");
    expect(writes.map((write) => write.kind)).toEqual(["declare"]);
    expect(submitted).toEqual(["0x1"]);
  });

  test("does not interpret RPC failures as absent resources", async () => {
    const { local, account, writes } = fixture();
    account.getClassHashAt = async () => {
      throw new Error("RPC unavailable");
    };
    await expect(deployWorld(local, account, () => {})).rejects.toThrow("RPC unavailable");
    expect(writes).toEqual([]);
  });
});
