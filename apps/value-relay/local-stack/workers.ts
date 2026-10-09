import {
  Miniflare,
  Log,
  LogLevel,
  fetch as localFetch,
  Response as LocalResponse,
  type WorkerOptions,
} from "miniflare";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { loopbackUrl, type StackConfig } from "./config";
import type { Assets, LocalAccount } from "./assets";

export interface NativeCredentials {
  address: string;
  privateKey: string;
}
interface Secrets {
  operatorToken: string;
  authSecret: string;
  vapid: { publicKey: string; privateKey: string };
}
export interface Manifest {
  version: number;
  chainId: string;
  accountClassHash: string;
  guardianPublicKey: string;
  rpcUrl: string;
  admissionUrl: string;
  contracts: Record<string, string>;
}

interface StackWorkers {
  root: string;
  config: StackConfig;
  manifest: Manifest;
  assets: Assets;
  accounts: LocalAccount[];
  secrets: Secrets;
  guardianKey: string;
  launcher: NativeCredentials;
  operator: NativeCredentials;
}

export const startWorkers = async (input: StackWorkers) => {
  const { root, config } = input;
  const origin = `https://localhost:${config.port}`;
  const l2 = `http://127.0.0.1:${config.devnetPort}/rpc`;
  const workers = buildWorkerOptions(input, origin, l2);
  const network = localNetwork(config, origin, l2, input.manifest.admissionUrl);
  for (const worker of workers) worker.outboundService = network;
  let mf: Miniflare | undefined;
  try {
    mf = new Miniflare({
      workers,
      host: "127.0.0.1",
      port: config.port,
      https: true,
      httpsKey: await readFile(join(config.stateDirectory, "tls.key"), "utf8"),
      httpsCert: await readFile(join(config.stateDirectory, "tls.crt"), "utf8"),
      d1Persist: join(config.stateDirectory, "d1"),
      durableObjectsPersist: join(config.stateDirectory, "do"),
      log: new Log(LogLevel.NONE),
      handleRuntimeStdio: (stdout: Readable, stderr: Readable) => {
        stdout.resume();
        stderr.resume();
      },
    });
    await mf.ready;
    await migrateDatabases(mf, root);
    return { mf, origin };
  } catch (error) {
    if (mf) await mf.dispose().catch(() => undefined);
    const code = (error as { code?: unknown })?.code;
    // Configuration diagnostics can contain bindings: expose only a known runtime error code.
    throw new Error(
      "local_workers_startup_failed" + (typeof code === "string" && /^[A-Z_]{1,64}$/.test(code) ? ":" + code : ""),
    );
  }
};

const buildWorkerOptions = (input: StackWorkers, origin: string, l2: string): WorkerOptions[] => {
  const { config, manifest, assets, accounts, secrets, guardianKey, launcher, operator } = input;
  loopbackUrl(manifest.admissionUrl);
  const spec = (name: string, app: string, configFile = "wrangler.jsonc"): WorkerOptions => {
    const directory = join(
      config.stateDirectory,
      "bundles",
      app,
      configFile.replaceAll("/", "-").replace(".jsonc", ""),
    );
    return {
      name,
      modulesRoot: directory,
      modules: [
        {
          type: "ESModule",
          path: join(directory, name === "edge" ? "edge.js" : name === "monitor" ? "monitor-worker.js" : "worker.js"),
        },
      ],
      compatibilityDate: "2026-07-30",
      compatibilityFlags: ["nodejs_compat"],
    };
  };
  const common = {
    SHARD_CHAIN_ID: manifest.chainId,
    SHARD_GAMES_ADDRESS: manifest.contracts.games!,
    SHARD_RPC_URL: `${origin}/rpc`,
    SHARD_HERALD_URL: origin,
    LEDGER_RPC_URL: l2,
    LEDGER_ADDRESS: assets.ledger,
    OPERATOR_TOKEN: secrets.operatorToken,
    BASE_URL: origin,
  };
  const service = (name: string, entrypoint?: string) => (entrypoint ? { name, entrypoint } : name);
  const workers: WorkerOptions[] = [
    {
      ...spec("edge", "value-relay", "local-stack/edge.wrangler.jsonc"),
      assets: {
        directory: config.frontendDirectory,
        binding: "ASSETS",
        routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true },
        assetConfig: { not_found_handling: "single-page-application" },
      },
      serviceBindings: {
        IDENTITY: "identity",
        LAUNCH: "launch",
        RELAY: "relay",
        MONITOR: "monitor",
        GUARDIAN: "guardian",
      },
      bindings: {
        SHARD_HERALD_URL: config.shardHeraldUrl,
        SHARD_RPC_URL: config.shardRpcUrl,
        SHARD_ADMISSION_URL: manifest.admissionUrl,
        LEDGER_RPC_URL: l2,
        LOCAL_VALUE: JSON.stringify({
          ...assets,
          ledgerRpcUrl: `${origin}/l2/rpc`,
          shardUrl: origin,
          chainId: manifest.chainId,
        }),
      },
    },
    { ...spec("guardian", "guardian"), bindings: { GUARDIAN_PRIVATE_KEY: guardianKey } },
    {
      ...spec("identity", "realms"),
      d1Databases: { DB: "identity" },
      versionMetadata: "VERSION",
      durableObjects: Object.fromEntries(
        [
          ["SHARD_NOTIFIER", "ShardNotifier"],
          ["RATING_READER", "RatingReader"],
          ["CHAT_ROOM", "ChatRoom"],
          ["CHAT_INBOX", "ChatInbox"],
        ].map(([binding, className]) => [binding!, { className: className!, useSQLite: true }]),
      ),
      serviceBindings: { GUARDIAN: "guardian", LAUNCH: "launch" },
      ratelimits: {
        DIRECTORY_RATE_LIMIT: { namespace_id: "1005", simple: { limit: 600, period: 60 } },
        PUBLIC_RATE_LIMIT: { namespace_id: "1001", simple: { limit: 30, period: 60 } },
        SIGN_IN_CODE_RATE_LIMIT: { namespace_id: "1003", simple: { limit: 3, period: 60 } },
      },
      bindings: {
        ENVIRONMENT: "staging",
        BASE_URL: origin,
        ACCOUNT_CLASS_HASH: manifest.accountClassHash,
        BETTER_AUTH_SECRET: secrets.authSecret,
        IDENTITY_RPC_URL: l2,
        OPERATOR_TOKEN: secrets.operatorToken,
        DISCORD_CLIENT_ID: "local-disabled",
        DISCORD_CLIENT_SECRET: "local-disabled",
        RESEND_API_KEY: "local-inbox",
        WEB_PUSH_VAPID_PUBLIC_KEY: secrets.vapid.publicKey,
        WEB_PUSH_VAPID_PRIVATE_KEY: secrets.vapid.privateKey,
        WEB_PUSH_VAPID_SUBJECT: "mailto:local@localhost",
        SHARD_NOTIFIER_POLL_MS: "3000",
      },
    },
    {
      ...spec("launch", "launch-service"),
      d1Databases: { DB: "launch" },
      durableObjects: { REGISTRAR: { className: "Registrar", useSQLite: true } },
      versionMetadata: "VERSION",
      serviceBindings: { IDENTITY: "identity", VALUE_RELAY: service("relay", "ValueLaunch") },
      bindings: {
        ...common,
        ENVIRONMENT: "staging",
        SHARD_URL: origin,
        LAUNCHER_ALLOWLIST: launcher.address,
        DEPLOYER_ACCOUNT_ADDRESS: launcher.address,
        DEPLOYER_PRIVATE_KEY: launcher.privateKey,
      },
    },
    {
      ...spec("relay", "value-relay"),
      durableObjects: { RELAY: { className: "ValueRelay", useSQLite: true } },
      serviceBindings: { IDENTITY: service("identity", "ValueIdentity") },
      bindings: {
        ...common,
        REALMS_ADDRESS: assets.realms,
        LEDGER_OPERATOR_ADDRESS: accounts[1]!.address,
        LEDGER_OPERATOR_PRIVATE_KEY: accounts[1]!.private_key,
        SHARD_LEDGER_OPERATOR_ADDRESS: operator.address,
        SHARD_LEDGER_OPERATOR_PRIVATE_KEY: operator.privateKey,
      },
    },
    {
      ...spec("monitor", "value-relay", "monitor.wrangler.jsonc"),
      durableObjects: { MONITOR: { className: "ValueMonitor", useSQLite: true } },
      serviceBindings: {
        IDENTITY: service("identity", "ValueIdentity"),
        RELAY_REPORT: service("relay", "RelayDiagnostics"),
      },
      bindings: {
        ...common,
        PAUSER_ACCOUNT_ADDRESS: accounts[2]!.address,
        PAUSER_PRIVATE_KEY: accounts[2]!.private_key,
      },
    },
  ];
  return workers;
};

const localNetwork =
  (config: StackConfig, origin: string, l2: string, admissionUrl: string) => async (request: Request) => {
    const url = new URL(request.url);
    if (url.href === "https://api.resend.com/emails") {
      const email = await request.json();
      const path = join(config.stateDirectory, "inbox", `${Date.now()}-${crypto.randomUUID()}.json`);
      await mkdir(join(config.stateDirectory, "inbox"), { recursive: true, mode: 0o700 });
      await writeFile(path, JSON.stringify(email), { mode: 0o600, flag: "wx" });
      return Response.json({ id: "local-delivery" });
    }
    let target = url;
    if (url.origin === origin) {
      if (url.pathname === "/rpc") target = new URL(config.shardRpcUrl);
      else if (url.pathname === "/admission") target = loopbackUrl(admissionUrl);
      else if (url.pathname === "/l2/rpc") target = new URL(l2);
      else if (url.pathname === "/manifest" || url.pathname === "/games" || url.pathname.startsWith("/games/"))
        target = new URL(url.pathname + url.search, config.shardHeraldUrl);
      else return new Response(null, { status: 403 });
    }
    const allowed = [
      new URL(config.shardRpcUrl).origin,
      new URL(config.shardHeraldUrl).origin,
      new URL(l2).origin,
      loopbackUrl(admissionUrl).origin,
    ];
    if (!allowed.includes(target.origin)) return new Response(null, { status: 403 });
    const headers = new Headers(request.headers);
    headers.delete("host");
    const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
    const response = await localFetch(target, {
      method: request.method,
      headers: Object.fromEntries(headers.entries()),
      ...(body ? { body } : {}),
      redirect: "manual",
      signal: request.signal,
    });
    if (target.origin === new URL(config.shardHeraldUrl).origin && target.pathname === "/manifest" && response.ok)
      return Response.json({
        ...((await response.json()) as object),
        rpcUrl: `${origin}/rpc`,
        admissionUrl: `${origin}/admission`,
      });
    return response;
  };

const migrateDatabases = async (mf: Miniflare, root: string) => {
  for (const [name, app] of [
    ["identity", "realms"],
    ["launch", "launch-service"],
  ] as const) {
    const db = await mf.getD1Database("DB", name);
    const migrationPath = join(root, "apps", app, "migrations");
    await db.exec("CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)");
    for (const file of (await readdir(migrationPath)).filter((file) => file.endsWith(".sql")).sort()) {
      if (await db.prepare("SELECT name FROM local_migrations WHERE name=?").bind(file).first()) continue;
      const sql = await readFile(join(migrationPath, file), "utf8");
      const statements = sql
        .replace(/^--.*$/gm, "")
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean);
      await db.batch([
        ...statements.map((statement) => db.prepare(statement)),
        db.prepare("INSERT INTO local_migrations (name) VALUES (?)").bind(file),
      ]);
    }
  }
};
