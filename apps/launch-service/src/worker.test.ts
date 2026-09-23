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

it("ticks the schedule, queues an authorized launch and records the registrar's attempt", async () => {
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
