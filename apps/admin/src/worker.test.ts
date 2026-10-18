import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { disposeWorker } from "../../../packages/value-ledger/test-support/workerd";
import environments from "../../../deploy/first/environments.json";

/**
 * Each environment's Worker as Cloudflare would run it: the bundle wrangler deploys for that environment, D1 and R2 in
 * workerd. Access, the launch services and the client are faked at the network edge.
 */
const TEAM = "realms.cloudflareaccess.com";
const AUD = "admin-aud";
const DEV = environments.dev.origin;
const PRODUCTION = environments.production.origin;
/** status-monitor keeps 90 days of uptime per probe, and its document guard refuses any other length. */
const NINETY_DAYS = Array.from({ length: 90 }, (_, day) => ({
  date: new Date(Date.UTC(2026, 6, 19 + day)).toISOString().slice(0, 10),
  uptime: 1,
}));

let dev: Miniflare;
let production: Miniflare;
let bundleRoot: string;
let signingKey: CryptoKey;
let strangerKey: CryptoKey;
/** The keys Access publishes; a test rotates them. */
let publishedKeys: (JsonWebKey & { kid: string })[] = [];
let launchCalls: { url: string; method: string; authorization: string | null; body: string }[] = [];
let launchRedirects = false;

const encode = (value: object | Uint8Array) =>
  Buffer.from(value instanceof Uint8Array ? value : JSON.stringify(value)).toString("base64url");
const rsaKeys = async () =>
  (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

/** An Access token for this team, signed as Access signs it. */
const accessToken = async (claims: Record<string, unknown>, key = signingKey, kid = "key-1") => {
  const header = encode({ alg: "RS256", kid, typ: "JWT" });
  const payload = encode({ iss: `https://${TEAM}`, exp: Math.floor(Date.now() / 1000) + 600, ...claims });
  const signed = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, signed);
  return `${header}.${payload}.${encode(new Uint8Array(signature))}`;
};
const owner = () => accessToken({ aud: [AUD], email: "owner@realms.world" });
/** An operator Access lets in, who is not among production's writers. */
const operator = () => accessToken({ aud: [AUD], email: "ops@realms.world" });

/** The page's own origin, which its fetches name on every write. */
const PAGE = "https://admin.test";

const call = async (
  worker: Miniflare,
  path: string,
  token: string | null,
  { origin = PAGE, ...init }: { method?: string; body?: string; origin?: string } = {},
) => {
  const headers: Record<string, string> = { origin, ...(token ? { "cf-access-jwt-assertion": token } : {}) };
  const response = await worker.dispatchFetch(`${PAGE}${path}`, { ...init, headers });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
};

const launchAnswer = (request: Request, body: string): Response => {
  const url = new URL(request.url);
  if (request.method !== "GET") return Response.json({ status: "queued" }, { status: 202 });
  if (url.pathname === "/api/factory/calendar")
    return Response.json({
      phases: [{ phase: "frontier", startsAt: "2026-10-15T20:00:00Z", endsAt: "2026-10-22T20:00:00Z" }],
    });
  if (url.pathname === "/api/slots") return Response.json({ slots: [] });
  if (url.pathname === "/api/factory/runs") {
    const environment = url.searchParams.get("environment");
    const createdAt = environment === "madara.blitz" ? "2026-10-16T10:00:00Z" : "2026-10-15T10:00:00Z";
    return Response.json({
      runs: [{ gameName: `${environment}-run`, environment, kind: "game", status: "complete", createdAt }],
    });
  }
  if (url.pathname === "/api/factory/version")
    return Response.json({ service: "launch", environment: "staging", version: "v-id", revision: "7ba76ed03a0" });
  if (url.pathname === "/sw.js") return new Response(`self.REALMS_RELEASE = "7ba76ed03a0";\nprecache();`);
  return Response.json({ error: `unexpected ${url.pathname} ${body}` }, { status: 404 });
};

const statusState = (chainId: string) =>
  JSON.stringify({
    document: {
      version: 1,
      checked_at: 1_760_625_000,
      components: [
        { id: "launch", name: "Launch service", status: "up", latency_ms: 120, since: 0, days: NINETY_DAYS },
      ],
      incidents: [],
    },
    targets: [{ url: "https://herald.test", chainId, status: "active" }],
    counters: {},
  });

/** One environment's admin, bundled by wrangler for that environment, with the secrets its setup installs. */
const startAdmin = async (
  wranglerEnvironment: "staging" | "production",
  secrets: Record<string, string>,
  chainId: string,
) => {
  const bundle = join(bundleRoot, wranglerEnvironment);
  execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--env", wranglerEnvironment, "--outdir", bundle], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "ignore",
  });
  const worker = new Miniflare({
    modulesRoot: bundle,
    modules: [{ type: "ESModule", path: join(bundle, "worker.js") }],
    compatibilityDate: "2026-07-30",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: { DB: `admin-${wranglerEnvironment}` },
    r2Buckets: { STATUS: `status-${wranglerEnvironment}` },
    serviceBindings: { ASSETS: () => new Response("the page") },
    bindings: {
      ADMIN_ENVIRONMENT: wranglerEnvironment === "staging" ? "dev" : "production",
      ACCESS_TEAM_DOMAIN: TEAM,
      ACCESS_AUD: AUD,
      ...secrets,
    },
    outboundService: async (request: Request) => {
      const url = new URL(request.url);
      if (url.host === TEAM && url.pathname === "/cdn-cgi/access/certs") return Response.json({ keys: publishedKeys });
      if (url.origin !== DEV && url.origin !== PRODUCTION) return new Response("unknown host", { status: 599 });
      const body = await request.text();
      if (request.method !== "GET") {
        if (launchRedirects)
          return new Response(null, { status: 302, headers: { location: "https://elsewhere.test/" } });
        launchCalls.push({
          url: request.url,
          method: request.method,
          authorization: request.headers.get("authorization"),
          body,
        });
      }
      return launchAnswer(request, body);
    },
  });
  const db = await worker.getD1Database("DB");
  const migrations = new URL("../migrations/", import.meta.url);
  const statements = readdirSync(migrations)
    .sort()
    .map((file) => readFileSync(new URL(file, migrations), "utf8").replace(/^--.*$/gm, ""))
    .join(";")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await db.batch(statements.map((statement) => db.prepare(statement)));
  await (await worker.getR2Bucket("STATUS")).put("state.json", statusState(chainId));
  return worker;
};

let publicKey: CryptoKey;
let strangerPublicKey: CryptoKey;

const publishedKey = async (key: CryptoKey, kid: string): Promise<JsonWebKey & { kid: string }> => ({
  ...((await crypto.subtle.exportKey("jwk", key)) as JsonWebKey),
  kid,
  alg: "RS256",
  use: "sig",
});

beforeAll(async () => {
  bundleRoot = mkdtempSync(join(tmpdir(), "admin-bundle-"));
  const pair = await rsaKeys();
  signingKey = pair.privateKey;
  publicKey = pair.publicKey;
  const stranger = await rsaKeys();
  strangerKey = stranger.privateKey;
  strangerPublicKey = stranger.publicKey;
  publishedKeys = [await publishedKey(publicKey, "key-1")];
  dev = await startAdmin("staging", { OPERATOR_TOKEN: "dev-operator-token" }, "0xdev");
  production = await startAdmin(
    "production",
    { OPERATOR_TOKEN: "production-operator-token", ADMIN_WRITERS: "owner@realms.world" },
    "0xmainnet",
  );
}, 180_000);

afterEach(async () => {
  launchCalls = [];
  launchRedirects = false;
  publishedKeys = publishedKeys.slice(0, 1);
  for (const worker of [dev, production]) await (await worker.getD1Database("DB")).prepare("DELETE FROM actions").run();
});

afterAll(async () => {
  await disposeWorker(dev);
  await disposeWorker(production);
  rmSync(bundleRoot, { recursive: true, force: true });
});

describe("who may call", () => {
  it("refuses a call without a live Access token of this team's application", async () => {
    expect((await call(dev, "/api/games", null)).status).toBe(403);
    const foreign = await accessToken({ aud: [AUD], email: "x@y" }, strangerKey);
    expect((await call(dev, "/api/games", foreign)).body).toEqual({ error: "Access token signature is invalid" });
    expect((await call(dev, "/api/games", await accessToken({ aud: ["other"], email: "x@y" }))).status).toBe(403);
    const expired = await accessToken({ aud: [AUD], email: "x@y", exp: 1 });
    expect((await call(dev, "/api/games", expired)).body).toEqual({ error: "Access session expired" });
    expect((await call(dev, "/api/session", await owner())).body).toEqual({
      email: "owner@realms.world",
      environment: "dev",
      other: { environment: "production", url: environments.production.admin },
    });
  });

  it("lets production's operators read, and only its writers act", async () => {
    expect((await call(production, "/api/games", await operator())).status).toBe(200);
    const slot = {
      method: "POST",
      body: JSON.stringify({ name: "blitz-20261017-1200", closesAt: "2026-10-17T11:55:00Z" }),
    };
    expect(await call(production, "/api/actions/slots", await operator(), slot)).toEqual({
      status: 403,
      body: { error: "Production actions are open to the owner's list only" },
    });
    expect(launchCalls).toEqual([]);
    expect((await call(production, "/api/audit", await owner())).body.actions).toEqual([]);
    expect((await call(production, "/api/actions/slots", await owner(), slot)).status).toBe(202);
    expect(launchCalls.map((sent) => [sent.url, sent.authorization])).toEqual([
      [`${PRODUCTION}/api/slots`, "Bearer production-operator-token"],
    ]);
  });

  it("refuses a write another site sends with the operator's cookie, sending and logging nothing", async () => {
    const slot = { method: "POST", body: JSON.stringify({ name: "blitz-20261017-1200" }) };
    for (const origin of ["https://attacker.test", "null", ""])
      expect(await call(production, "/api/actions/slots", await owner(), { ...slot, origin }), origin).toEqual({
        status: 403,
        body: { error: "Actions are sent from the admin page only" },
      });
    expect(launchCalls).toEqual([]);
    expect((await call(production, "/api/audit", await owner())).body.actions).toEqual([]);
  });

  it("accepts a token signed with a key Access rotated in after the keys were cached", async () => {
    expect((await call(dev, "/api/session", await owner())).status).toBe(200);
    publishedKeys = [...publishedKeys, await publishedKey(strangerPublicKey, "key-2")];
    const rotated = await accessToken({ aud: [AUD], email: "owner@realms.world" }, strangerKey, "key-2");
    expect((await call(dev, "/api/session", rotated)).status).toBe(200);
  });

  it("serves the page itself from the assets, without the API", async () => {
    expect(await (await dev.dispatchFetch("https://admin.test/")).text()).toBe("the page");
  });
});

describe("screens", () => {
  it("reads the Games screen from status-monitor and the environment's launch service", async () => {
    const { body } = await call(dev, "/api/games", await owner());
    expect(body.origin).toBe(DEV);
    expect(body.status).toEqual({
      ok: true,
      value: {
        checkedAt: 1_760_625_000,
        components: [{ id: "launch", name: "Launch service", status: "up", latency_ms: 120 }],
      },
    });
    expect(body.calendar.value).toEqual([
      { phase: "frontier", startsAt: "2026-10-15T20:00:00Z", endsAt: "2026-10-22T20:00:00Z" },
    ]);
    expect(body.runs.value.map((run: { gameName: string }) => run.gameName)).toEqual([
      "madara.blitz-run",
      "madara.frontier-run",
      "madara.eternum-run",
    ]);
  });

  it("shows what runs where and the commands that deploy it, sending nothing", async () => {
    expect((await call(production, "/api/deploys", await owner())).body).toEqual({
      environment: "production",
      workers: { ok: true, value: { version: "v-id", revision: "7ba76ed03a0" } },
      client: { ok: true, value: "7ba76ed03a0" },
      shards: { ok: true, value: [{ url: "https://herald.test", chainId: "0xmainnet", status: "active" }] },
      commands: {
        box: "pnpm run deploy production",
        cloudflare: 'pnpm run deploy:cloudflare production "$HOME/.realms-production"',
      },
    });
    expect(launchCalls).toEqual([]);
  });
});

describe("actions", () => {
  it("sends a free test Blitz to dev's launch service with dev's token and logs who sent it", async () => {
    const body = JSON.stringify({ name: "test-owner", players: ["0x1"] });
    expect(await call(dev, "/api/actions/test-blitz", await owner(), { method: "POST", body })).toEqual({
      status: 202,
      body: { status: "queued" },
    });
    expect(launchCalls).toEqual([
      { url: `${DEV}/api/factory/test-blitz`, method: "POST", authorization: "Bearer dev-operator-token", body },
    ]);
    expect((await call(dev, "/api/audit", await owner())).body.actions).toMatchObject([
      {
        email: "owner@realms.world",
        environment: "dev",
        action: "Free test Blitz",
        request: JSON.stringify({ method: "POST", path: "/api/factory/test-blitz", body: JSON.parse(body) }),
        state: "done",
        status: 202,
      },
    ]);
  });

  it("refuses a test Blitz on production, sending and logging nothing", async () => {
    const body = JSON.stringify({ name: "test-owner", players: ["0x1"] });
    expect((await call(production, "/api/actions/test-blitz", await owner(), { method: "POST", body })).status).toBe(
      404,
    );
    expect(launchCalls).toEqual([]);
    expect((await call(production, "/api/audit", await owner())).body.actions).toEqual([]);
  });

  it("deletes a production run with production's token, on the launch route it names", async () => {
    await call(production, "/api/actions/runs/madara.blitz/blitz-20261016-1400/delete", await owner(), {
      method: "POST",
    });
    expect(launchCalls).toEqual([
      {
        url: `${PRODUCTION}/api/factory/runs/madara.blitz/blitz-20261016-1400/actions/delete`,
        method: "POST",
        authorization: "Bearer production-operator-token",
        body: "",
      },
    ]);
  });

  it("refuses a route it cannot name exactly, before anything is sent", async () => {
    const token = await owner();
    for (const path of [
      "/api/actions/runs/madara.blitz/..%2Fslots/delete",
      "/api/actions/runs/other.env/name/delete",
      "/api/actions/results/madara.blitz/name/delete",
      "/api/actions/calendar/eternum",
      "/api/actions/slots/Upper/refund",
    ]) {
      const method = path.includes("calendar") ? "PUT" : "POST";
      expect((await call(dev, path, token, { method, body: "{}" })).status, path).toBe(404);
    }
    expect((await call(dev, "/api/actions/slots", token, { method: "POST", body: "[1]" })).status).toBe(400);
    expect(launchCalls).toEqual([]);
  });

  it("keeps a sent action in the log as failed when the launch service answers with a redirect it refuses", async () => {
    launchRedirects = true;
    const body = JSON.stringify({ startsAt: "2026-10-22T20:00:00Z", endsAt: "2026-10-29T20:00:00Z" });
    expect((await call(dev, "/api/actions/calendar/frontier", await owner(), { method: "PUT", body })).status).toBe(
      502,
    );
    expect((await call(dev, "/api/audit", await owner())).body.actions).toMatchObject([
      { action: "Set frontier phase", state: "failed", status: null, response: "operator_redirect_refused" },
    ]);
  });
});
