import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it } from "vitest";

/**
 * The Worker as Cloudflare runs it: the bundle wrangler deploys, its cron tick, its registrar Durable Object and D1 in
 * workerd. Identity and the shard are faked at the network edge.
 */
const ORIGIN = "https://staging.realms.party";
const LAUNCHER = "0x123";
const SHARD_URL = "https://shard.test";

let mf: Miniflare;
let db: D1Database;

beforeAll(async () => {
  const bundle = join(mkdtempSync(join(tmpdir(), "launch-bundle-")), "bundle");
  execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--env", "staging", "--outdir", bundle], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "ignore",
  });
  mf = new Miniflare({
    modulesRoot: bundle,
    modules: [{ type: "ESModule", path: join(bundle, "worker.js") }],
    compatibilityDate: "2026-07-30",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: { DB: "launch" },
    durableObjects: { REGISTRAR: { className: "Registrar", useSQLite: true } },
    serviceBindings: {
      IDENTITY: () => Response.json({ session: { id: "s1" }, user: { id: "u1", realmsId: "0x7", address: LAUNCHER } }),
    },
    bindings: {
      ENVIRONMENT: "staging",
      BASE_URL: ORIGIN,
      LAUNCHER_ALLOWLIST: LAUNCHER,
      SHARD_URL,
      DEPLOYER_ACCOUNT_ADDRESS: "0x456",
      DEPLOYER_PRIVATE_KEY: "0x1",
      OPERATOR_TOKEN: "operator-test-token",
      VERSION: { id: "workerd-test", tag: "", timestamp: "" },
    },
    outboundService: (request: Request) =>
      new Response(`${request.url} unavailable`, { status: request.url === `${SHARD_URL}/manifest` ? 503 : 599 }),
  });
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  const migrations = new URL("../migrations/", import.meta.url);
  const statements = readdirSync(migrations)
    .sort()
    .map((file) => readFileSync(new URL(file, migrations), "utf8").replace(/^--.*$/gm, ""))
    .join(";")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await db.batch(statements.map((statement) => db.prepare(statement)));
}, 180_000);

afterAll(() => mf?.dispose());

it("opens a Blitz window, ticks the schedule, queues an authorized launch and records the registrar's attempt", async () => {
  const window = {
    // A second ahead: a phase cannot start in the past, and the next slot must close after the window opens.
    startsAt: new Date(Math.ceil(Date.now() / 1_000) * 1_000 + 1_000).toISOString(),
    endsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  };
  const opened = await mf.dispatchFetch(`${ORIGIN}/api/factory/calendar/blitz`, {
    method: "PUT",
    headers: { origin: ORIGIN, authorization: "Bearer operator-test-token", "content-type": "application/json" },
    body: JSON.stringify(window),
  });
  expect(opened.status).toBe(200);
  await (await mf.getWorker()).scheduled({ cron: "* * * * *" });
  const slots = (await (await mf.dispatchFetch(`${ORIGIN}/api/slots`)).json()) as { slots: { name: string }[] };
  expect(slots.slots.map(({ name }) => name)).toEqual([expect.stringMatching(/^blitz-\d{8}-(11|20)00$/)]);

  expect(await (await mf.dispatchFetch(`${ORIGIN}/api/factory/health`)).json()).toMatchObject({
    service: "launch",
    environment: "staging",
    version: "workerd-test",
  });

  const launched = await mf.dispatchFetch(`${ORIGIN}/api/factory/runs`, {
    method: "POST",
    headers: { origin: ORIGIN, cookie: "better-auth.session_token=s1", "content-type": "application/json" },
    body: JSON.stringify({ environment: "madara.blitz", gameName: "bltz-workerd" }),
  });
  expect(launched.status).toBe(202);

  await (await mf.getWorker()).scheduled({ cron: "* * * * *" });
  const deadline = Date.now() + 10_000;
  let run: { status: string; attempts: number; error_message: string | null } | null = null;
  while (Date.now() < deadline && !run?.error_message) {
    run = await db.prepare("SELECT status, attempts, error_message FROM launch_runs").first();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(run).toMatchObject({ status: "queued", attempts: 1 });
  expect(run?.error_message).toMatch(new RegExp(`^Shard ${SHARD_URL} manifest failed: 503`));
}, 60_000);

it("launches a game that is ready now while a result waits an hour for its game's end", async () => {
  const tick = async () => (await mf.getWorker()).scheduled({ cron: "* * * * *" });
  const runOf = (name: string) =>
    db.prepare("SELECT attempts, error_message FROM launch_runs WHERE name = ?").bind(name).first<{
      attempts: number;
      error_message: string | null;
    }>();
  await db.prepare("DELETE FROM launch_runs").run();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO launch_runs (id, kind, environment, name, request, status, available_at, created_at, updated_at)
       VALUES ('waiting-result', 'result', 'madara.blitz', 'bltz-later', ?, 'queued', ?, ?, ?)`,
    )
    .bind(JSON.stringify({ environment: "madara.blitz", gameName: "bltz-later", gameId: 4 }), now + 3_600_000, now, now)
    .run();
  await tick(); // a pass finds nothing due and sleeps until the result's hour
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  const launched = await mf.dispatchFetch(`${ORIGIN}/api/factory/runs`, {
    method: "POST",
    headers: { origin: ORIGIN, cookie: "better-auth.session_token=s1", "content-type": "application/json" },
    body: JSON.stringify({ environment: "madara.blitz", gameName: "bltz-ready" }),
  });
  expect(launched.status).toBe(202);
  await tick();

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && !(await runOf("bltz-ready"))?.error_message) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(await runOf("bltz-ready")).toMatchObject({ attempts: 1 });
  expect(await runOf("bltz-later")).toMatchObject({ attempts: 0 });
}, 60_000);

it("runs a continued launch at once, even while the registrar sleeps until a result's hour", async () => {
  await db.prepare("DELETE FROM launch_runs").run();
  const now = Date.now();
  const insert = (id: string, kind: string, name: string, status: string, availableAt: number, request: object) =>
    db
      .prepare(
        `INSERT INTO launch_runs (id, kind, environment, name, request, status, available_at, created_at, updated_at)
         VALUES (?, ?, 'madara.blitz', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, kind, name, JSON.stringify(request), status, availableAt, now, now)
      .run();
  await insert("waiting", "result", "bltz-later", "queued", now + 3_600_000, {
    environment: "madara.blitz",
    gameName: "bltz-later",
    gameId: 4,
  });
  await insert("stopped", "game", "bltz-failed", "failed", now, {
    environment: "madara.blitz",
    gameName: "bltz-failed",
    gameStartTime: new Date(now + 600_000).toISOString(),
  });
  await (await mf.getWorker()).scheduled({ cron: "* * * * *" }); // the registrar now sleeps until the result's hour
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  const continued = await mf.dispatchFetch(`${ORIGIN}/api/factory/runs/madara.blitz/bltz-failed/actions/continue`, {
    method: "POST",
    headers: { authorization: "Bearer operator-test-token" },
  });
  expect(continued.status).toBe(202);

  // No cron tick: the continue itself armed the registrar.
  const deadline = Date.now() + 10_000;
  let run: { attempts: number; error_message: string | null } | null = null;
  while (Date.now() < deadline && !run?.error_message) {
    run = await db.prepare("SELECT attempts, error_message FROM launch_runs WHERE name = 'bltz-failed'").first();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(run).toMatchObject({ attempts: 1 });
}, 60_000);
