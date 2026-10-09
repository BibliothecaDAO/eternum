import { execFileSync } from "node:child_process";
import { mkdir, rm, chmod } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ec, logger, RpcProvider, num, shortString } from "starknet";
import { Effect } from "effect";
import { readConfig, readPrivate, privateWrite, prepareState, type StackConfig } from "./config";
import { deployAssets, type LocalAccount } from "./assets";
import { startIdentity, startWorkers, type Manifest, type NativeCredentials } from "./workers";
import { runScheduledWorkers } from "./schedule";

const configPath = process.argv[2];
if (!configPath) throw new Error("Usage: value-stack:up CONFIG_JSON");
let phase = "configuration";
process.umask(0o077);
logger.setLogLevel("FATAL");

const run = async () => {
  const base = await readConfig(configPath);
  const state = await prepareState(base);
  const runDirectory = join(state.directory, `run-${Date.now()}`);
  const config = { ...base, stateDirectory: runDirectory };
  await mkdir(runDirectory, { mode: 0o700 });
  // Exclusive ownership prevents a second supervisor from replacing a live stack's record.
  await privateWrite(state.pid, {
    pid: process.pid,
    configPath: resolve(configPath),
    container: state.container,
    runDirectory,
  });
  let mf: Awaited<ReturnType<typeof startWorkers>>["mf"] | undefined;
  let containerStarted = false;
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try {
      if (mf) await mf.dispose();
    } finally {
      if (containerStarted) execFileSync("docker", ["rm", "-f", state.container], { stdio: "ignore" });
    }
    await rm(state.pid, { force: true });
  };
  const shutdown = new AbortController();
  process.once("SIGINT", () => shutdown.abort());
  process.once("SIGTERM", () => shutdown.abort());
  try {
    const guardian = await readPrivate<{ privateKey: string }>(config.guardianKeyFile);
    const launcher = await readPrivate<NativeCredentials>(config.launcherKeyFile);
    const operator = await readPrivate<NativeCredentials>(config.ledgerOperatorKeyFile);
    const bootstrap = await readPrivate<{ chainId: string; classHash: string; guardianPublicKey: string }>(
      join(resolve(config.guardianKeyFile, ".."), "native-bootstrap.json"),
    );
    phase = "devnet";
    createDevnetContainer(config, state.container);
    containerStarted = true;
    const accounts = await startDevnet(config, state.container);
    const secrets = await localSecrets();
    await privateWrite(join(runDirectory, "credentials.json"), { accounts, ...secrets });
    const root = resolve(import.meta.dirname, "../../..");
    phase = "local_certificate";
    await createCertificate(runDirectory);
    phase = "worker_bundles";
    execFileSync("flock", ["/tmp/eternum-client.lock", "bun", "local-stack/bundle.ts", join(runDirectory, "bundles")], {
      cwd: join(root, "apps/value-relay"),
      stdio: "ignore",
    });
    shutdown.signal.throwIfAborted();
    phase = "identity";
    const identity = await startIdentity({
      root,
      config,
      secrets,
      guardianKey: guardian.privateKey,
      launcher,
      operator,
      manifest: {
        version: 1,
        chainId: bootstrap.chainId,
        accountClassHash: bootstrap.classHash,
        guardianPublicKey: bootstrap.guardianPublicKey,
        rpcUrl: config.shardRpcUrl,
        releaseSchemas: {},
        l2GasBound: "0x47868c00",
        contracts: {},
      },
    });
    mf = identity.mf;
    console.log(JSON.stringify({ status: "identity_ready_before_shard", origin: identity.origin }));
    phase = "shard_initialization";
    const { manifest } = await waitForNative(config, shutdown.signal);
    phase = "ledger_deployment";
    const assets = await deployAssets(root, config, accounts, manifest);
    await privateWrite(join(runDirectory, "assets.json"), assets);
    phase = "workers";
    const workers = await startWorkers(
      {
        root,
        config,
        manifest,
        assets,
        accounts,
        secrets,
        guardianKey: guardian.privateKey,
        launcher,
        operator,
      },
      mf,
    );
    mf = workers.mf;
    console.log(
      JSON.stringify({
        status: "value_services_ready",
        origin: workers.origin,
        ledgerRpc: `http://127.0.0.1:${config.devnetPort}/rpc`,
        runDirectory,
        assets,
      }),
    );
    await runScheduledWorkers(mf, shutdown.signal);
  } finally {
    await stop();
  }
};
const readNativeInputs = async (config: StackConfig) => {
  const guardian = await readPrivate<{ privateKey: string }>(config.guardianKeyFile);
  const launcher = await readPrivate<NativeCredentials>(config.launcherKeyFile);
  const operator = await readPrivate<NativeCredentials>(config.ledgerOperatorKeyFile);
  if (
    !guardian.privateKey ||
    !launcher.privateKey ||
    !operator.privateKey ||
    !launcher.address ||
    !operator.address ||
    BigInt(launcher.address) === BigInt(operator.address)
  )
    throw new Error("distinct_enrolled_native_operators_required");
  const manifestResponse = await fetch(new URL("/manifest", config.shardHeraldUrl));
  if (!manifestResponse.ok) throw new Error("manifest_unavailable");
  const manifest = (await manifestResponse.json()) as Manifest;
  if (
    manifest.version !== 1 ||
    !manifest.contracts.games ||
    BigInt(manifest.guardianPublicKey) !== BigInt(ec.starkCurve.getStarkKey(guardian.privateKey))
  )
    throw new Error("fresh_shard_guardian_differs");
  const provider = new RpcProvider({ nodeUrl: config.shardRpcUrl });
  if (BigInt(await provider.getChainId()) !== BigInt(manifest.chainId)) throw new Error("shard_chain_differs");
  await assertApprovedDevice(provider, launcher, manifest.accountClassHash);
  await assertApprovedDevice(provider, operator, manifest.accountClassHash);
  return { guardian, launcher, operator, manifest };
};

const assertApprovedDevice = async (provider: RpcProvider, device: NativeCredentials, classHash: string) => {
  if (BigInt(await provider.getClassHashAt(device.address)) !== BigInt(classHash))
    throw new Error("native_operator_class_differs");
  const digest = "0xf00d";
  const signature = ec.starkCurve.sign(digest, device.privateKey);
  const valid = await provider.callContract(
    {
      contractAddress: device.address,
      entrypoint: "is_valid_signature",
      calldata: [
        digest,
        "3",
        ec.starkCurve.getStarkKey(device.privateKey),
        num.toHex(signature.r),
        num.toHex(signature.s),
      ],
    },
    "latest",
  );
  if (valid.length !== 1 || BigInt(valid[0]!) !== BigInt(shortString.encodeShortString("VALID")))
    throw new Error("native_operator_device_not_approved");
};

const createDevnetContainer = (config: StackConfig, container: string) => {
  // No Docker log storage: the node's startup output contains pre-funded private keys.
  execFileSync(
    "docker",
    [
      "create",
      "--name",
      container,
      "--log-driver",
      "none",
      "--publish",
      `127.0.0.1:${config.devnetPort}:5050`,
      "docker.io/shardlabs/starknet-devnet-rs:0.10.0",
      "--host",
      "0.0.0.0",
      "--port",
      "5050",
      "--start-time",
      "1",
      "--accounts",
      "9",
      "--block-generation-on",
      "3",
      "--state-archive-capacity",
      "full",
    ],
    { stdio: "ignore" },
  );
};

const startDevnet = async (config: StackConfig, container: string): Promise<LocalAccount[]> => {
  execFileSync("docker", ["start", container], { stdio: "ignore" });
  let accounts: LocalAccount[] | undefined;
  for (let attempts = 0; attempts < 120; attempts++) {
    try {
      const response = await fetch(`http://127.0.0.1:${config.devnetPort}/predeployed_accounts`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        accounts = (await response.json()) as LocalAccount[];
        break;
      }
    } catch {
      /* Startup is bounded; credentials are never printed. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!accounts || accounts.length < 3 || accounts.some((account) => !account.address || !account.private_key))
    throw new Error("devnet_accounts_unavailable");
  return accounts;
};

const localSecrets = async () => {
  const vapid = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", vapid.privateKey)) as JsonWebKey;
  const secrets = {
    operatorToken: crypto.randomUUID() + crypto.randomUUID(),
    authSecret: crypto.randomUUID() + crypto.randomUUID(),
    vapid: {
      publicKey: Buffer.from(await crypto.subtle.exportKey("raw", vapid.publicKey)).toString("base64url"),
      privateKey: jwk.d!,
    },
  };
  return secrets;
};

const createCertificate = async (directory: string) => {
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "7",
      "-keyout",
      join(directory, "tls.key"),
      "-out",
      join(directory, "tls.crt"),
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  await chmod(join(directory, "tls.key"), 0o600);
};

const waitForNative = async (config: StackConfig, signal: AbortSignal) => {
  while (!signal.aborted) {
    try {
      return await readNativeInputs(config);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  signal.throwIfAborted();
  throw new Error("native_startup_interrupted");
};

await Effect.runPromise(
  Effect.tryPromise({
    try: run,
    catch: (error) =>
      new Error(
        `Local value stack failed during ${phase}; ${error instanceof Error && /^local_workers_startup_failed(?::[A-Z_]+)?$/.test(error.message) ? error.message : "no credential or SDK error detail was logged"}.`,
      ),
  }),
).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
