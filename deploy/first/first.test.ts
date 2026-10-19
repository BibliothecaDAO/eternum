import { validateInputs } from "./dates";
import { afterEach, expect, mock, test } from "bun:test";
import { chmodSync, existsSync, lstatSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Account, hash, num, type RpcProvider } from "starknet";
import { PrivateStore } from "./private-store";
import { runSteps, type Step } from "./run";
import { environments, ACCOUNT_CLASS, WEI, root, type Inputs } from "./settings";
import { accountIdentity, classAt, prepareAccounts, send, type Keys } from "./chain";
import {
  assetPlans,
  fixedSalt,
  deployAsset,
  setupCalls,
  setupPresenceReader,
  verifyLedgerAccounts,
  type AssetPlan,
} from "./ledger";
import { Platform, workerSecrets, workers, type Secrets } from "./platform";
import { preparationSteps, type Deployment } from "./main";
import { validateDates } from "./dates";
import { artifactFiles } from "./box";

const temporary: string[] = [];
const fetchBefore = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchBefore;
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});
function storage(write = true) {
  const base = mkdtempSync(join(tmpdir(), "first-deployment-test-"));
  temporary.push(base);
  const repository = join(base, "repo");
  mkdirSync(repository);
  return { base, repository, store: new PrivateStore(join(base, "private"), repository, write) };
}
// Deliberately public throwaway test scalars. These never leave mocked transports.
const keys: Keys = { deployer: "0x123", relay: "0x124", monitor: "0x125", launcher: "0x126", shardRelay: "0x127" };
const secrets: Secrets = {
  auth: "fake-auth",
  operator: "fake-operator",
  vapidPublic: "fake-public",
  vapidPrivate: "fake-private",
};
const input: Inputs = {
  cloudflareToken: "fake-cloudflare",
  rpc: "https://starknet-mainnet.g.alchemy.com/v2/throwaway",
  resend: "fake-resend",
  amount: "1000000",
  frontierStart: "2027-01-01T00:00:00Z",
  frontierEnd: "2027-01-21T00:00:00Z",
  blitzStart: "2027-01-01T00:00:00Z",
  blitzEnd: "2027-02-01T00:00:00Z",
};
const assets = { ledger: "0x10", lords: "0x11", mmr: "0x12", chests: "0x13", cosmetics: "0x14" };

test("retired resource settings in saved owner inputs do not require setup again", () => {
  const { store } = storage();
  const saved = { ...input, node_memory: "24g", herald_memory: "6g", NODE_MEMORY: "24g" };
  store.write("inputs.json", saved);
  const loaded = store.read<Inputs>("inputs.json")!;
  expect(() => validateInputs(loaded, environments.dev)).not.toThrow();
  expect(loaded.cloudflareToken && loaded.rpc).toBeTruthy();
  expect(store.read<typeof saved>("inputs.json")).toEqual(saved);
});

test("default storage is read-only and creates no directory; explicit writes refuse", () => {
  const { store } = storage(false);
  expect(existsSync(store.directory)).toBe(false);
  expect(() => store.write("keys.json", keys)).toThrow("Dry run");
  expect(() => store.lock()).toThrow("Dry run");
  expect(existsSync(store.directory)).toBe(false);
});

test("private credentials have exact modes and cannot be placed in the repository", () => {
  const { store, repository } = storage();
  store.write("keys.json", keys);
  expect(lstatSync(store.directory).mode & 0o777).toBe(0o700);
  expect(lstatSync(join(store.directory, "keys.json")).mode & 0o777).toBe(0o600);
  expect(store.read<Keys>("keys.json")).toEqual(keys);
  expect(() => new PrivateStore(join(repository, "private"), repository, true)).toThrow("repository");
  chmodSync(join(store.directory, "keys.json"), 0o644);
  expect(() => store.read<Keys>("keys.json")).toThrow("0600");
});

test("private storage refuses symlinks, traversal, a shared directory and concurrent writers", () => {
  const { base, repository, store } = storage();
  symlinkSync(store.directory, join(base, "link"));
  expect(() => new PrivateStore(join(base, "link"), repository)).toThrow("0700");
  expect(() => store.read("../keys.json")).toThrow("record name");
  const unlock = store.lock();
  expect(() => store.lock()).toThrow("running");
  unlock();
  chmodSync(store.directory, 0o755);
  expect(() => new PrivateStore(store.directory, repository)).toThrow("0700");
});

test.each([
  "http://starknet-mainnet.g.alchemy.com/a",
  "https://public-node.test",
  "https://user:secret@starknet-mainnet.g.alchemy.com/a",
  "https://starknet-sepolia.g.alchemy.com/a",
])("refuses RPC %s", (rpc) => {
  expect(() => validateInputs({ ...input, rpc }, environments.dev)).toThrow();
});

test("positive integral deposit and duration required; a cold-admin target asks for public cold accounts only", () => {
  for (const amount of ["0", "-1", "1.1", "1e6", (2n ** 128n).toString()])
    expect(() => validateInputs({ ...input, amount }, environments.dev)).toThrow();
  expect(() => validateInputs({ ...input, blitzEnd: input.blitzStart }, environments.dev)).toThrow();
  const cold = { ...environments.production, coldAdmin: true };
  expect(() => validateInputs(input, cold)).toThrow("public cold");
  expect(() => validateInputs({ ...input, admin: "0x9", treasury: "0xa" }, cold)).not.toThrow();
  expect(() => validateInputs(input, environments.production)).not.toThrow();
});

test("dry run inspects every step, including unavailable ones, and never calls a write", async () => {
  const inspect = mock(async () => ({ done: false, detail: "missing", waiting: "owner action" }));
  const write = mock(async () => {
    throw new Error("write escaped dry run");
  });
  const steps: Step[] = [
    { name: "accounts", payer: "deployer", cost: "reserve", inspect, apply: write },
    {
      name: "network",
      payer: "none",
      cost: "0",
      inspect: async () => {
        throw new Error("fake-secret must not print");
      },
      apply: write,
    },
    { name: "workers", payer: "none", cost: "0", inspect, apply: write },
  ];
  const output: string[] = [];
  await runSteps(steps, false, (line) => output.push(line));
  expect(inspect).toHaveBeenCalledTimes(2);
  expect(write).not.toHaveBeenCalled();
  expect(output).toHaveLength(6);
  expect(output.join("\n")).not.toContain("fake-secret");
});

test.each([0, 1, 2, 3, 4])("rerun after boundary %s skips observed results", async (interrupted) => {
  const done = Array.from({ length: 5 }, (_, index) => index < interrupted);
  const writes: number[] = [];
  const steps = done.map(
    (_, index): Step => ({
      name: String(index),
      payer: "none",
      cost: "0",
      inspect: async () => ({ done: done[index]!, detail: "checked remotely" }),
      apply: async () => {
        done[index] = true;
        writes.push(index);
      },
    }),
  );
  await runSteps(steps, true, () => {});
  await runSteps(steps, true, () => {});
  expect(writes).toEqual([0, 1, 2, 3, 4].slice(interrupted));
});

test("a pending owner action stops apply before any later write", async () => {
  const write = mock(async () => {});
  expect(
    await runSteps(
      [
        {
          name: "merge",
          payer: "owner",
          cost: "0",
          inspect: async () => ({ done: false, detail: "merge needed", waiting: "exact command" }),
          apply: write,
        },
        {
          name: "deploy",
          payer: "none",
          cost: "0",
          inspect: async () => ({ done: false, detail: "missing" }),
          apply: write,
        },
      ],
      true,
      () => {},
    ),
  ).toBe(false);
  expect(write).not.toHaveBeenCalled();
});

test("all preparation probes are read-only with missing prerequisites", async () => {
  const { store } = storage(false);
  const context: Deployment = {
    environment: "dev",
    target: environments.dev,
    revision: "a".repeat(40),
    store,
    apply: false,
    output: () => {},
  };
  const writes = mock(async () => {
    throw new Error("write");
  });
  const steps = preparationSteps(context)
    .filter((step) => step.name !== "Box operator credential")
    .map((step) => ({ ...step, apply: writes }));
  await runSteps(steps, false, () => {});
  expect(writes).not.toHaveBeenCalled();
  expect(existsSync(store.directory)).toBe(false);
});

test("account addresses are deterministic and all three mainnet roles differ", () => {
  expect(accountIdentity(keys.deployer)).toEqual(accountIdentity(keys.deployer));
  expect(new Set([keys.deployer, keys.relay, keys.monitor].map((key) => accountIdentity(key).address)).size).toBe(3);
});

test("RPC outages are never interpreted as absent contracts", async () => {
  const provider = {
    getClassHashAt: async () => {
      throw { code: 429 };
    },
  } as unknown as RpcProvider;
  await expect(classAt(provider, "0x1")).rejects.toEqual({ code: 429 });
  provider.getClassHashAt = async () => {
    throw { code: 20 };
  };
  expect(await classAt(provider, "0x1")).toBeUndefined();
});

test("a lost invoke response retries the same nonce while it remains current", async () => {
  const { store } = storage();
  const nonces: string[] = [];
  let first = true;
  const account = {
    address: "0x100",
    getNonce: mock(async () => "7"),
    execute: async (_calls: unknown, options: { nonce: string }) => {
      nonces.push(options.nonce);
      if (first) {
        first = false;
        throw new Error("reply lost");
      }
      return { transaction_hash: "0xabc" };
    },
    waitForTransaction: async () => ({ execution_status: "SUCCEEDED" }),
  } as unknown as Account;
  const calls = [{ contractAddress: "0x1", entrypoint: "transfer", calldata: ["2", "30", "0"] }];
  await expect(send(account, calls, store, "relay", () => {}, 5)).rejects.toThrow("reply lost");
  await send(account, calls, store, "relay", () => {}, 5);
  expect(nonces).toEqual(["7", "7"]);
  expect(account.getNonce).toHaveBeenCalledTimes(2);
  await send(account, [{ ...calls[0]!, calldata: ["2", "31", "0"] }], store, "relay", () => {}, 5);
  expect(nonces).toEqual(["7", "7", "7"]);
});

test("dev deploys five assets; production deploys only a cold-admin ledger with existing assets", () => {
  const dev = assetPlans(environments.dev, "0x20", "0x21", "0x22", assets);
  expect(dev.map((plan) => plan.artifact)).toEqual([
    "TestLords",
    "MMRToken",
    "RealmsCollectible",
    "RealmsCollectible",
    "GameLedger",
  ]);
  const production = assetPlans(environments.production, "0xc01d", "0x21", "0x22", assets);
  expect(production).toHaveLength(1);
  expect(production[0]!.constructor).toEqual([
    "0xc01d",
    "0x21",
    "0x22",
    assets.lords,
    assets.mmr,
    assets.chests,
    assets.cosmetics,
  ]);
  expect(fixedSalt("dev", "0x123", "ledger")).not.toBe(fixedSalt("production", "0x123", "ledger"));
});

test("fixed salt deploy resumes after a lost acknowledgement without declaring or deploying again", async () => {
  const { store } = storage();
  const artifact = {
    contract: {
      contract_class_version: "0.1.0",
      sierra_program: ["0x1"],
      entry_points_by_type: { EXTERNAL: [], L1_HANDLER: [], CONSTRUCTOR: [] },
      abi: [],
    },
    casm: {},
  };
  const classHash = hash.computeSierraContractClassHash(artifact.contract);
  let deployed = false;
  const declare = mock(async () => ({ class_hash: classHash }));
  const plan: AssetPlan = { name: "lords", artifact: "TestLords", package: "ledger", constructor: [] };
  const address = hash.calculateContractAddressFromHash(fixedSalt("dev", "0x123", "lords"), classHash, [], 0);
  const deploy = mock(async () => {
    deployed = true;
    throw new Error("reply lost");
  });
  const account = {
    address: "0x123",
    getClassHashAt: async () => {
      if (deployed) return classHash;
      throw { code: 20 };
    },
    getClassByHash: async () => ({}),
    declareIfNot: declare,
    deployContract: deploy,
  } as unknown as Account;
  await expect(deployAsset(account, "dev", plan, artifact, store, () => {})).rejects.toThrow("reply lost");
  expect(await deployAsset(account, "dev", plan, artifact, store, () => {})).toBe(address);
  expect(declare).not.toHaveBeenCalled();
  expect(deploy).toHaveBeenCalledTimes(1);
  await expect(deployAsset(account, "dev", { ...plan, constructor: ["1"] }, artifact, store, () => {})).rejects.toThrow(
    "differs",
  );
});

test("setup keeps only missing role calls; production registers exactly dev's presets on the ledger they share", async () => {
  const dev = setupCalls(environments.dev, assets, "0x33", 4000, 9000, 1);
  const presets = (calls: typeof dev) => calls.filter((call) => call.entrypoint === "register_preset");
  expect(presets(dev).map((call) => (call.calldata as string[])[0])).toEqual(["1", "2"]);
  const production = setupCalls(environments.production, assets, "0x33", 4000, 9000, 1);
  // Ledger preset ids are global: any other id or economics would be refused as "Registered preset differs".
  expect(presets(production)).toEqual(presets(dev));
  expect(production.find((call) => call.entrypoint === "open_season")).toEqual(
    dev.find((call) => call.entrypoint === "open_season"),
  );
  expect(production.some((call) => call.entrypoint === "set_attrs_raw_to_ipfs_cid")).toBe(false);
  const provider = { callContract: async () => ["0x1"] } as unknown as RpcProvider;
  expect(await setupPresenceReader(provider)(dev[0]!, 10)).toBe(true);
  provider.callContract = async () => ["0x0"];
  expect(await setupPresenceReader(provider)(dev[0]!, 10)).toBe(false);
});

test("metadata presence follows all confirmed event pages; differing metadata refuses", async () => {
  const operation = setupCalls(environments.dev, assets, "0x33", 4000, 9000, 1).find(
    (call) => call.entrypoint === "set_attrs_raw_to_ipfs_cid",
  )!;
  const args = operation.calldata as string[];
  const event = {
    keys: [hash.getSelectorFromName("AttrsRawToIPFSCIDUpdated"), ...args.slice(0, -1).map(num.toHex)],
  };
  const getEvents = mock(async (request: { continuation_token?: string; keys: string[][] }) =>
    request.continuation_token
      ? {
          events: [event].filter((event) =>
            request.keys.every((keys, index) =>
              keys.every((key) => /^0x[0-9a-f]+$/i.test(key) && BigInt(key) === BigInt(event.keys[index]!)),
            ),
          ),
        }
      : { events: [], continuation_token: "second" },
  );
  expect(BigInt(args[0]!)).toBeGreaterThan(9n);
  expect(
    await setupPresenceReader({ getEvents, getClassHashAt: async () => "0x1" } as unknown as RpcProvider)(
      operation,
      19,
    ),
  ).toBe(true);
  expect(getEvents).toHaveBeenCalledTimes(2);
  expect((await getEvents({ continuation_token: "second", keys: [[event.keys[0]!], [args[0]!]] })).events).toEqual([]);
  event.keys[2] = "0x2";
  await expect(
    setupPresenceReader({ getEvents, getClassHashAt: async () => "0x1" } as unknown as RpcProvider)(operation, 19),
  ).rejects.toThrow("metadata differs");
});

test("every service uses one RPC; deployer and cold admin keys never enter Worker values", () => {
  const access = { teamDomain: "realms.cloudflareaccess.com", audience: "aud", operators: ["o@x.io"], writers: [] };
  const map = Object.fromEntries(
    workers.map((worker) => [worker.id, workerSecrets(worker, input, secrets, keys, access)]),
  );
  for (const name of ["identity", "relay", "monitor", "status"]) expect(map[name]!.L2_RPC_URL).toBe(input.rpc);
  expect(map.guardian).toEqual({});
  expect(map.relay!.LEDGER_OPERATOR_PRIVATE_KEY).toBe(keys.relay);
  expect(map.monitor!.PAUSER_PRIVATE_KEY).toBe(keys.monitor);
  expect(Object.values(map).flatMap(Object.values)).not.toContain(keys.deployer);
  expect(map.launch!.LAUNCH_DEPLOYER_PRIVATE_KEY).toBe(keys.launcher);
  expect(map.admin).toEqual({
    OPERATOR_TOKEN: secrets.operator,
    ACCESS_TEAM_DOMAIN: "realms.cloudflareaccess.com",
    ACCESS_AUD: "aud",
  });
  const admin = workers.find((worker) => worker.id === "admin")!;
  expect(() => workerSecrets(admin, input, secrets, keys, undefined)).toThrow("Admin access is not set up yet");
});

test("the status monitor emails incidents through the identity Worker's Resend key, to the address setup recorded", () => {
  const status = workers.find((worker) => worker.id === "status")!;
  expect(workerSecrets(status, { ...input, alertEmail: "oncall@example.test" }, secrets, keys, undefined)).toEqual({
    L2_RPC_URL: input.rpc,
    RESEND_API_KEY: input.resend,
    ALERT_EMAIL: "oncall@example.test",
  });
  expect(workerSecrets(status, { ...input, alertEmail: undefined }, secrets, keys, undefined)).toEqual({
    L2_RPC_URL: input.rpc,
    RESEND_API_KEY: input.resend,
  });
});

test("dry platform refuses every write entry before any network or subprocess call", async () => {
  const { store } = storage(false);
  const platform = new Platform(environments.dev, input, store, false);
  const fetch = mock(async () => {
    throw new Error("network must not be called");
  });
  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
  await expect(platform.cf("/anything", "POST", {})).rejects.toThrow("Dry run");
  await expect(platform.bootstrapWorkers()).rejects.toThrow("Dry run");
  await expect(platform.wrangler(workers[0], ["deploy"])).rejects.toThrow("Dry run");
  expect(fetch).not.toHaveBeenCalled();
});

test("an existing guardian secret is never uploaded or replaced", async () => {
  const { store } = storage();
  const platform = new Platform(environments.dev, input, store, true);
  platform.secretNames = async () => ["GUARDIAN_PRIVATE_KEY"];
  const wrangler = mock(async () => "");
  platform.wrangler = wrangler;
  await platform.installSecrets(workers[0], { GUARDIAN_PRIVATE_KEY: "throwaway-new-key-must-not-be-used" });
  expect(wrangler).not.toHaveBeenCalled();
});

test("missing secrets use stdin JSON, never argv; a retry preserves existing ones", async () => {
  const { store } = storage();
  const platform = new Platform(environments.dev, input, store, true);
  const sentinel = "throwaway-sensitive-value";
  let present: string[] = [];
  platform.secretNames = async () => present;
  const commands: unknown[] = [];
  platform.wrangler = async (_worker, argv, body) => {
    expect(JSON.stringify(argv)).not.toContain(sentinel);
    expect(JSON.parse(body!)).toEqual({ OPERATOR_TOKEN: sentinel });
    commands.push(argv);
    present = ["OPERATOR_TOKEN"];
    return "";
  };
  await platform.installSecrets(workers[1], { OPERATOR_TOKEN: sentinel });
  await platform.installSecrets(workers[1], { OPERATOR_TOKEN: sentinel });
  expect(commands).toHaveLength(1);
});

test("release artifact list includes Sierra and CASM for each of the four declared classes", () => {
  expect(artifactFiles).toHaveLength(8);
  expect(new Set(artifactFiles.map((file) => file.packageName))).toEqual(new Set(["ledger", "mmr", "collectibles"]));
});

test.each(["none", "relay", "monitor"])(
  "reserve funding is not repeated after a lost %s reply and lagging reads",
  async (lostRole) => {
    const { store } = storage();
    const deployed = new Set<string>();
    const holdings = new Map<string, bigint>();
    const identities = Object.values(keys).map((key) => accountIdentity(key));
    const byAddress = new Map(identities.map((identity) => [identity.address, identity]));
    let nonce = 0;
    let observedBlock: number | undefined;
    let interrupted = false;
    const blocks = new Map<number, Map<string, bigint>>();
    const remember = () => blocks.set(nonce, new Map(holdings));
    const provider = {
      getChainId: async () => "0x534e5f4d41494e",
      getBlockNumber: async () => observedBlock ?? nonce,
      getClassByHash: async () => ({}),
      getClassHashAt: async (address: string) => {
        if (deployed.has(address)) return ACCOUNT_CLASS;
        throw { code: 20 };
      },
      callContract: async (
        call: { contractAddress: string; entrypoint: string; calldata: string[] },
        block: number | "latest",
      ) => {
        remember();
        if (call.entrypoint === "get_public_key") return [byAddress.get(call.contractAddress)!.publicKey];
        const balances = typeof block === "number" ? blocks.get(block)! : holdings;
        return [String(balances.get(call.calldata[0]!) ?? 0n), "0"];
      },
      waitForTransaction: async () => ({ execution_status: "SUCCEEDED" }),
    } as unknown as RpcProvider;
    const transfers: string[] = [];
    for (const role of ["relay", "monitor"])
      store.write(`transaction-fund-${role}.json`, {
        nonce: "0",
        calls: [{ contractAddress: "0xbad", entrypoint: "transfer", calldata: ["999", "99", "0"] }],
      });
    const factory = (address: string) =>
      ({
        address,
        getNonce: async (block?: number) => String(block ?? nonce),
        execute: async (calls: { calldata: string[] }[], options: { nonce: string }) => {
          if (options.nonce !== String(nonce)) throw new Error("stale nonce");
          remember();
          nonce++;
          for (const call of calls) {
            const [to, low] = call.calldata;
            const recipient = `0x${BigInt(to!).toString(16)}`;
            holdings.set(recipient, (holdings.get(recipient) ?? 0n) + BigInt(low!));
            transfers.push(`0x${BigInt(to!).toString(16)}`);
          }
          if (
            !interrupted &&
            lostRole !== "none" &&
            transfers.at(-1) === accountIdentity(keys[lostRole as "relay" | "monitor"]).address
          ) {
            interrupted = true;
            throw new Error("reply lost");
          }
          return { transaction_hash: "0xabc" };
        },
        deployAccount: async () => {
          expect(holdings.get(address)).toBeGreaterThan(0n);
          deployed.add(address);
          return { transaction_hash: "0xdef" };
        },
        waitForTransaction: provider.waitForTransaction,
      }) as unknown as Account;
    const output: string[] = [];
    expect(
      await prepareAccounts(provider, keys, store, (line) => output.push(line), 250n * WEI, factory),
    ).toBeUndefined();
    const deployer = accountIdentity(keys.deployer).address;
    expect(output).toHaveLength(1);
    expect(output[0]).toContain(deployer);
    expect(output[0]).not.toContain(accountIdentity(keys.relay).address);
    holdings.set(deployer, 250n * WEI);
    if (lostRole !== "none") {
      await expect(prepareAccounts(provider, keys, store, () => {}, 250n * WEI, factory)).rejects.toThrow("reply lost");
      observedBlock = nonce - 1;
      const sent = transfers.length;
      await expect(prepareAccounts(provider, keys, store, () => {}, 250n * WEI, factory)).rejects.toThrow(
        "stale nonce",
      );
      expect(transfers).toHaveLength(sent);
      observedBlock = undefined;
    }
    await prepareAccounts(provider, keys, store, (line) => output.push(line), 250n * WEI, factory);
    await prepareAccounts(provider, keys, store, (line) => output.push(line), 250n * WEI, factory);
    expect(deployed.size).toBe(3);
    expect(transfers).toEqual([accountIdentity(keys.relay).address, accountIdentity(keys.monitor).address]);
    expect(holdings.get(accountIdentity(keys.relay).address)).toBe(30n * WEI);
    expect(holdings.get(accountIdentity(keys.monitor).address)).toBe(WEI);
  },
);

test("all four dates are required without defaults and invalid Frontier end gives two exact alternatives", () => {
  expect(() => validateDates(input)).not.toThrow();
  for (const field of ["frontierStart", "frontierEnd", "blitzStart", "blitzEnd"])
    expect(() => validateDates({ ...input, [field]: "" })).toThrow("without a default");
  expect(() => validateDates({ ...input, frontierEnd: "2027-01-02T00:00:00Z" })).toThrow("nearest valid ends:");
  expect(() => validateDates({ ...input, frontierStart: "2027-01-01T00:00:01Z" })).toThrow("s tick");
});

test("the actual default command cannot write files, submit RPC or generate keys", async () => {
  const { base, store } = storage();
  store.write("deployment.json", { environment: "dev", revision: "b".repeat(40) });
  store.write("inputs.json", input);
  store.write("keys.json", keys);
  store.write("secrets.json", secrets);
  const preload = join(base, "readonly.ts");
  writeFileSync(
    preload,
    `
import { mock } from 'bun:test';
import * as fs from 'node:fs';
const originalOpen = fs.openSync;
const originalRead = fs.readFileSync;
const deny = () => { process.stderr.write('FORBIDDEN_WRITE'); throw new Error('dry mutation'); };
mock.module('node:fs', () => ({...fs,
 readFileSync:(path, ...rest)=>String(path).endsWith('/contracts/common/addresses/dev.json') ? '{}' : originalRead(path,...rest),
 writeFileSync:deny, mkdirSync:deny, renameSync:deny, unlinkSync:deny,
 openSync:(path, flags, ...rest)=> { if (flags !== fs.constants.O_RDONLY + fs.constants.O_NOFOLLOW && flags !== fs.constants.O_RDONLY) return deny(); return originalOpen(path,flags,...rest); }}));
const operations = [];
globalThis.fetch = async (url, init={}) => {
 const target = String(url);
 if (target.startsWith('https://starknet-mainnet.g.alchemy.com/')) {
  const request = JSON.parse(init.body);
  if (!['starknet_chainId','starknet_getClassHashAt','starknet_getClass'].includes(request.method)) return deny();
  const result = request.method === 'starknet_chainId' ? '0x534e5f4d41494e' : request.method === 'starknet_getClassHashAt' ? ${JSON.stringify(ACCOUNT_CLASS)} : {sierra_program:[],contract_class_version:'0.1.0',entry_points_by_type:{EXTERNAL:[],CONSTRUCTOR:[],L1_HANDLER:[]},abi:'[]'};
  return Response.json({jsonrpc:'2.0',id:request.id,result});
 }
 if (target.startsWith('https://api.cloudflare.com/client/v4/')) {
  if ((init.method ?? 'GET') !== 'GET') return deny();
  let result = target.endsWith('/accounts') ? [{id:'test-account'}] : target.endsWith('/r2/buckets') ? {buckets:[]} : target.includes('/zones?name=') ? [{id:'test-zone'}] : [];
  return Response.json({success:true,result});
 }
 return deny();
};
const chain = await import(${JSON.stringify(join(root, "deploy/first/chain.ts"))});
mock.module(${JSON.stringify(join(root, "deploy/first/chain.ts"))}, () => ({...chain, newKey:deny}));
const processTools = await import(${JSON.stringify(join(root, "deploy/first/process.ts"))});
mock.module(${JSON.stringify(join(root, "deploy/first/process.ts"))}, () => ({...processTools, shell:value=>value, command:async ({argv,input}) => {
 operations.push(argv.join(' '));
 if (argv[0] === 'ssh') {
  if (String(input).includes('print(f.read') || String(input).includes('git clone')) return deny();
  return String(input).includes("print('present')") ? 'present' : String(input).includes('native-world.json') ? 'null' : '';
 }
 if (argv[0] === 'git' && ['ls-remote', 'fetch', 'diff', 'status'].includes(argv[1])) return '';
 if (argv[0] === 'git' && argv[1] === 'rev-parse') return 'a'.repeat(40);
 if (argv[0] === 'python3') return JSON.stringify({ revision: 'a'.repeat(40) });
 if (argv[0] === 'gh' && argv[1] === 'run') return '[]';
 if (argv[0] === 'gh' && argv[1] === 'api' && argv[2] === 'repos/{owner}/{repo}') return '{}';
 return deny();
}}));
`,
  );
  const result = Bun.spawn(
    [
      process.execPath,
      "--no-env-file",
      "--preload",
      preload,
      join(root, "deploy/first/main.ts"),
      "dev",
      store.directory,
    ],
    {
      cwd: root,
      env: { PATH: process.env.PATH!, HOME: base, BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const output = await new Response(result.stdout).text();
  const errors = await new Response(result.stderr).text();
  expect(errors).toBe("");
  expect(await result.exited).toBe(0);
  expect(output).toContain("DRY RUN");
  expect(output).toContain(`Deployment commit ${"a".repeat(40)}.`);
  expect(output).not.toContain("b".repeat(40));
  expect(output).not.toContain("Published pool and automatic Blitz slot");
  expect(output).toContain("Public address book commit");
  expect(output).not.toContain("unavailable; read failed");
  for (const secret of [
    input.cloudflareToken,
    input.rpc,
    input.resend,
    secrets.auth,
    secrets.operator,
    ...Object.values(keys),
  ])
    expect(output).not.toContain(secret);
  expect(existsSync(join(store.directory, "running.json"))).toBe(false);
});

test("setup refuses a different confirmed Blitz window without replacing it", async () => {
  const operation = setupCalls(environments.dev, assets, "0x33", 4000, 9000, 1).find(
    (call) => call.entrypoint === "open_season",
  )!;
  const season = ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "1", "1", "4000", "9000", "0", "0"];
  const provider = { callContract: async () => season } as unknown as RpcProvider;
  expect(await setupPresenceReader(provider)(operation, 5)).toBe(true);
  season[13] = "9001";
  await expect(setupPresenceReader(provider)(operation, 5)).rejects.toThrow("Existing Blitz season differs");
});

test("resuming an existing ledger refuses different saved accounts", async () => {
  const calls: unknown[] = [];
  let allowed = true;
  const provider = {
    callContract: async (call: unknown) => {
      calls.push(call);
      return [allowed ? "1" : "0"];
    },
  } as unknown as RpcProvider;
  await verifyLedgerAccounts(provider, assets.ledger, "0x20", "0x21");
  expect(calls).toHaveLength(2);
  allowed = false;
  await expect(verifyLedgerAccounts(provider, assets.ledger, "0x30", "0x31")).rejects.toThrow("different accounts");
});
