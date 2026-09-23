import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";

/**
 * The Worker as Cloudflare runs it, for tests: the bundle wrangler would deploy, its Durable Objects, alarms and D1 in
 * workerd, over storage that survives a restart. Only the network is faked, by `outbound`.
 */
export const WORKER_NAME = "identity";

export const buildWorkerBundle = (): string => {
  const bundle = join(mkdtempSync(join(tmpdir(), "identity-bundle-")), "bundle");
  execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--env", "staging", "--outdir", bundle], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "ignore",
  });
  return bundle;
};

export const startWorker = async (options: {
  bundle: string;
  storage: string;
  vapid: { publicKey: string; privateKey: string };
  outbound: (request: Request) => Response | Promise<Response>;
}) => {
  const mf = new Miniflare({
    name: WORKER_NAME,
    modulesRoot: options.bundle,
    modules: [{ type: "ESModule", path: join(options.bundle, "worker.js") }],
    compatibilityDate: "2026-07-30",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: { DB: "identity" },
    d1Persist: join(options.storage, "d1"),
    durableObjects: {
      SHARD_NOTIFIER: { className: "ShardNotifier", useSQLite: true },
      CHAT_ROOM: { className: "ChatRoom", useSQLite: true },
      CHAT_INBOX: { className: "ChatInbox", useSQLite: true },
    },
    durableObjectsPersist: join(options.storage, "do"),
    ratelimits: { PUBLIC_RATE_LIMIT: { namespace_id: "1001", simple: { limit: 1000, period: 60 } } },
    bindings: {
      ENVIRONMENT: "staging",
      BASE_URL: "https://staging.realms.party",
      ACCOUNT_CLASS_HASH: "0x1",
      BETTER_AUTH_SECRET: "workerd-test-secret-workerd-test-secret",
      IDENTITY_RPC_URL: "http://127.0.0.1:1",
      DIRECTORY_ADMIN_TOKEN: "unused",
      WEB_PUSH_VAPID_PUBLIC_KEY: options.vapid.publicKey,
      WEB_PUSH_VAPID_PRIVATE_KEY: options.vapid.privateKey,
      WEB_PUSH_VAPID_SUBJECT: "mailto:ops@realms.party",
    },
    outboundService: options.outbound,
  });
  return {
    mf,
    db: (await mf.getD1Database("DB")) as unknown as D1Database,
    dispose: () => mf.dispose(),
    runCron: async () => (await mf.getWorker()).scheduled({ cron: "* * * * *" }),
  };
};

/** Every migration in order, as `wrangler d1 migrations apply` would run them. */
export const migrationStatements = (): string[] => {
  const migrations = new URL("../migrations/", import.meta.url);
  return readdirSync(migrations)
    .sort()
    .map((file) => readFileSync(new URL(file, migrations), "utf8"))
    .join(";\n")
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
};

export const newStorage = () => mkdtempSync(join(tmpdir(), "identity-storage-"));

const base64url = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes as ArrayBuffer).toString("base64url");

export const vapidKeys = async () => {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", keys.privateKey)) as JsonWebKey;
  const raw = (await crypto.subtle.exportKey("raw", keys.publicKey)) as ArrayBuffer;
  return { publicKey: base64url(raw), privateKey: jwk.d! };
};

export const deviceKeys = async () => {
  const keys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  return {
    p256dh: base64url((await crypto.subtle.exportKey("raw", keys.publicKey)) as ArrayBuffer),
    auth: base64url(crypto.getRandomValues(new Uint8Array(16))),
  };
};

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitUntil = async (condition: () => boolean, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && Date.now() < deadline) await pause(100);
};
