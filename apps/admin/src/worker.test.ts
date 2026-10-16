import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { disposeWorker } from "../../../packages/value-ledger/test-support/workerd";
import environments from "../../../deploy/first/environments.json";

/**
 * The Worker as Cloudflare would run it: the bundle wrangler deploys, D1 and R2 in workerd. Access, the launch
 * services and the client are faked at the network edge.
 */
const TEAM = "realms.cloudflareaccess.com";
const AUD = "admin-aud";
const PRODUCTION_AUD = "admin-production-aud";
const DEV = environments.dev.origin;
const PRODUCTION = environments.production.origin;
const ADMIN = "https://admin.realms.party";
/** status-monitor keeps 90 days of uptime per probe, and its document guard refuses any other length. */
const NINETY_DAYS = Array.from({ length: 90 }, (_, day) => ({
  date: new Date(Date.UTC(2026, 6, 19 + day)).toISOString().slice(0, 10),
  uptime: 1,
}));

let mf: Miniflare;
let bundleRoot: string;
let signingKey: CryptoKey;
let strangerKey: CryptoKey;
let launchCalls: { url: string; method: string; authorization: string | null; body: string }[] = [];
let launchDown = false;

const encode = (value: object | Uint8Array) =>
  Buffer.from(value instanceof Uint8Array ? value : JSON.stringify(value)).toString("base64url");

/** An Access token for this team, signed as Access signs it. */
const accessToken = async (claims: Record<string, unknown>, key = signingKey, kid = "key-1") => {
  const header = encode({ alg: "RS256", kid, typ: "JWT" });
  const payload = encode({ iss: `https://${TEAM}`, exp: Math.floor(Date.now() / 1000) + 600, ...claims });
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${encode(new Uint8Array(signature))}`;
};
const owner = (aud = AUD) => accessToken({ aud: [aud], email: "owner@realms.world" });

const call = async (path: string, token: string | null, init: { method?: string; body?: string } = {}) => {
  const headers: Record<string, string> = token ? { "cf-access-jwt-assertion": token } : {};
  const response = await mf.dispatchFetch(`${ADMIN}${path}`, { ...init, headers });
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
    return Response.json({
      runs: [
        {
          gameName: `${environment}-run`,
          environment,
          kind: "game",
          status: "complete",
          createdAt: environment === "madara.blitz" ? "2026-10-16T10:00:00Z" : "2026-10-15T10:00:00Z",
        },
      ],
    });
  }
  if (url.pathname === "/api/factory/version")
    return Response.json({ service: "launch", environment: "staging", version: "v-id", revision: "7ba76ed03a0" });
  if (url.pathname === "/sw.js") return new Response(`self.REALMS_RELEASE = "7ba76ed03a0";\nprecache();`);
  return Response.json({ error: `unexpected ${url.pathname} ${body}` }, { status: 404 });
};

beforeAll(async () => {
  bundleRoot = mkdtempSync(join(tmpdir(), "admin-bundle-"));
  const bundle = join(bundleRoot, "bundle");
  execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--env", "production", "--outdir", bundle], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "ignore",
  });
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  signingKey = pair.privateKey;
  strangerKey = (
    (await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair
  ).privateKey;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "key-1", alg: "RS256", use: "sig" };
  mf = new Miniflare({
    modulesRoot: bundle,
    modules: [{ type: "ESModule", path: join(bundle, "worker.js") }],
    compatibilityDate: "2026-07-30",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: { AUDIT: "admin" },
    r2Buckets: { STATUS_DEV: "status-dev", STATUS_PRODUCTION: "status-production" },
    serviceBindings: { ASSETS: () => new Response("the page") },
    bindings: {
      ADMIN_HOSTNAME: "admin.realms.party",
      ACCESS_TEAM_DOMAIN: TEAM,
      ACCESS_AUD: AUD,
      ACCESS_PRODUCTION_AUD: PRODUCTION_AUD,
      OPERATOR_TOKEN_DEV: "dev-operator-token",
      OPERATOR_TOKEN_PRODUCTION: "production-operator-token",
    },
    outboundService: async (request: Request) => {
      const url = new URL(request.url);
      if (url.host === TEAM && url.pathname === "/cdn-cgi/access/certs") return Response.json({ keys: [jwk] });
      if (url.origin !== DEV && url.origin !== PRODUCTION) return new Response("unknown host", { status: 599 });
      const body = await request.text();
      if (request.method !== "GET") {
        if (launchDown) return new Response(null, { status: 302, headers: { location: "https://elsewhere.test/" } });
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
  const db = await mf.getD1Database("AUDIT");
  const migrations = new URL("../migrations/", import.meta.url);
  const statements = readdirSync(migrations)
    .sort()
    .map((file) => readFileSync(new URL(file, migrations), "utf8").replace(/^--.*$/gm, ""))
    .join(";")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await db.batch(statements.map((statement) => db.prepare(statement)));
  const status = (chainId: string) =>
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
  await (await mf.getR2Bucket("STATUS_DEV")).put("state.json", status("0xdev"));
  await (await mf.getR2Bucket("STATUS_PRODUCTION")).put("state.json", status("0xmainnet"));
}, 180_000);

afterEach(async () => {
  launchCalls = [];
  launchDown = false;
  await (await mf.getD1Database("AUDIT")).prepare("DELETE FROM actions").run();
});

afterAll(async () => {
  await disposeWorker(mf);
  rmSync(bundleRoot, { recursive: true, force: true });
});

describe("who may call", () => {
  it("refuses a call without a live Access token of this team's application", async () => {
    expect((await call("/api/dev/games", null)).status).toBe(403);
    expect((await call("/api/dev/games", await accessToken({ aud: [AUD], email: "x@y" }, strangerKey))).body).toEqual({
      error: "Access token signature is invalid",
    });
    expect((await call("/api/dev/games", await accessToken({ aud: ["other"], email: "x@y" }))).status).toBe(403);
    expect((await call("/api/dev/games", await accessToken({ aud: [AUD], email: "x@y", exp: 1 }))).body).toEqual({
      error: "Access session expired",
    });
    expect((await call("/api/dev/session", await owner())).body).toEqual({ email: "owner@realms.world" });
  });

  it("opens production only to the production application's list", async () => {
    expect((await call("/api/production/games", await owner())).body).toEqual({
      error: "Access token for another application",
    });
    expect((await call("/api/production/games", await owner(PRODUCTION_AUD))).status).toBe(200);
    expect(launchCalls).toEqual([]);
  });

  it("serves the page itself from the assets, without the API", async () => {
    const page = await mf.dispatchFetch(`${ADMIN}/`);
    expect(await page.text()).toBe("the page");
  });
});

describe("screens", () => {
  it("reads the Games screen from status-monitor and the environment's launch service", async () => {
    const { body } = await call("/api/dev/games", await owner());
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
    const { body } = await call("/api/production/deploys", await owner(PRODUCTION_AUD));
    expect(body).toEqual({
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
    const answer = await call("/api/dev/test-blitz", await owner(), { method: "POST", body });
    expect(answer).toEqual({ status: 202, body: { status: "queued" } });
    expect(launchCalls).toEqual([
      { url: `${DEV}/api/factory/test-blitz`, method: "POST", authorization: "Bearer dev-operator-token", body },
    ]);
    const { body: audit } = await call("/api/audit", await owner());
    expect(audit.actions).toMatchObject([
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
    const answer = await call("/api/production/test-blitz", await owner(PRODUCTION_AUD), {
      method: "POST",
      body: JSON.stringify({ name: "test-owner", players: ["0x1"] }),
    });
    expect(answer.status).toBe(404);
    expect(launchCalls).toEqual([]);
    expect((await call("/api/audit", await owner())).body.actions).toEqual([]);
  });

  it("deletes a production run with production's token, on the launch route it names", async () => {
    await call("/api/production/runs/madara.blitz/blitz-20261016-1400/delete", await owner(PRODUCTION_AUD), {
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
      "/api/dev/runs/madara.blitz/..%2Fslots/delete",
      "/api/dev/runs/other.env/name/delete",
      "/api/dev/results/madara.blitz/name/delete",
      "/api/staging/slots",
      "/api/dev/calendar/eternum",
    ])
      expect(
        (await call(path, token, { method: path.includes("calendar") ? "PUT" : "POST", body: "{}" })).status,
        path,
      ).toBe(404);
    expect((await call("/api/dev/slots", token, { method: "POST", body: "[1]" })).status).toBe(400);
    expect(launchCalls).toEqual([]);
  });

  it("keeps a sent action in the log as failed when the launch service answers with a redirect it refuses", async () => {
    launchDown = true;
    const answer = await call("/api/dev/calendar/frontier", await owner(), {
      method: "PUT",
      body: JSON.stringify({ startsAt: "2026-10-22T20:00:00Z", endsAt: "2026-10-29T20:00:00Z" }),
    });
    expect(answer.status).toBe(502);
    expect((await call("/api/audit", await owner())).body.actions).toMatchObject([
      { action: "Set frontier phase", state: "failed", status: null, response: "operator_redirect_refused" },
    ]);
  });
});
