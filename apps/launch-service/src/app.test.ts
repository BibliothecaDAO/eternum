import { slotResolver } from "./paid-blitz";
import { day, frontierSeasonEnd } from "./test-dates";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createLaunchApp } from "./app";
import { D1LaunchStore } from "./store";
import { D1SlotStore } from "./slot-store";
import { D1CalendarStore } from "./calendar-store";
import {
  createLaunchTestDatabase,
  testChain,
  slotValueFixture,
  registrationIdentityFixture,
  TEST_CHAIN,
  DEV_CHAIN,
  PRODUCTION_CHAIN,
} from "./test-database";
import type { ReleaseReport } from "./release";

const token = { authorization: "Bearer operator-test-token", "content-type": "application/json" };
const session = { cookie: "session=valid", origin: "https://play.realms.party", "content-type": "application/json" };
let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.close();
});
const fixture = (chain = TEST_CHAIN) => {
  const store = new D1LaunchStore(database.db, testChain(chain));
  const value = slotValueFixture(1);
  const slots = new D1SlotStore(database.db, store, value, slotResolver(value, registrationIdentityFixture));
  const calendar = new D1CalendarStore(database.db);
  const armFor = vi.fn();
  const wakeAt = vi.fn(async (): Promise<number | null> => 0);
  const joinFailures = vi.fn(async (): Promise<import("./registrar").JoinFailure[]> => []);
  const applyRelease = vi.fn(async (releaseId: number): Promise<ReleaseReport> => ({ releaseId, shards: [] }));
  const app = createLaunchApp({
    config: { operatorToken: "operator-test-token" },
    deployment: { environment: "staging", version: "test", revision: "abc1234" },
    store,
    slots,
    calendar,
    registrar: { armFor, joinFailures, wakeAt, applyRelease },
  });
  return { app, store, slots, calendar, value, armFor, joinFailures, wakeAt, applyRelease };
};
const close = () => new Date(Math.floor(Date.now() / 1000) * 1000 + 60000).toISOString();
test("the create-run and launcher-discovery routes are gone even for the operator", async () => {
  const { app, store } = fixture();
  expect((await app.request("/api/factory/launcher")).status).toBe(404);
  expect((await app.request("/api/factory/operator/launcher/enrol", { method: "POST", headers: token })).status).toBe(
    404,
  );
  for (const environment of ["madara.eternum", "madara.frontier", "madara.blitz"]) {
    expect(
      (
        await app.request("/api/factory/runs", {
          method: "POST",
          headers: token,
          body: JSON.stringify({ environment, gameName: "free-game" }),
        })
      ).status,
    ).toBe(404);
    expect(await store.list(environment as never)).toEqual([]);
  }
});
test.each([
  ["POST", "/api/slots"],
  ["POST", "/api/slots/friday/refund"],
  ["PUT", "/api/factory/calendar/frontier"],
  ["POST", "/api/factory/runs/madara.frontier/frontier-7/actions/continue"],
  ["POST", "/api/factory/runs/madara.eternum/old/actions/delete"],
  ["POST", "/api/factory/results/madara.blitz/old/actions/continue"],
  ["POST", "/api/factory/test-blitz"],
  ["POST", "/api/factory/release"],
])("requires an operator token for %s %s", async (method, url) => {
  const { app } = fixture();
  for (const headers of [session, {}, { authorization: "Bearer wrong" }] as Record<string, string>[])
    expect((await app.request(url, { method, headers, body: "{}" })).status).toBe(403);
});
test("operator slots and public discovery preserve the shard key and immutable schedule", async () => {
  const { app, slots } = fixture();
  const closesAt = close();
  expect(
    (
      await app.request("/api/slots", {
        method: "POST",
        headers: token,
        body: JSON.stringify({ name: "friday", closesAt }),
      })
    ).status,
  ).toBe(202);
  const found = await app.request("/api/slots/friday");
  expect(await found.json()).toMatchObject({ chainId: TEST_CHAIN, name: "friday", closesAt });
  expect(found.headers.get("cache-control")).toBe("no-store");
  vi.spyOn(slots, "list").mockRejectedValue(new Error("no scan"));
  expect((await app.request("/api/slots/friday")).status).toBe(200);
  expect((await app.request("/api/slots/missing")).status).toBe(404);
});
test.each(["check-probe", "frontier-123"])("reserves %s before inserting a slot", async (name) => {
  const { app, slots } = fixture();
  expect(
    (
      await app.request("/api/slots", {
        method: "POST",
        headers: token,
        body: JSON.stringify({ name, closesAt: close() }),
      })
    ).status,
  ).toBe(400);
  expect(await slots.list()).toEqual([]);
});
test("the operator sets calendar phases while reads stay public", async () => {
  const { app } = fixture();
  expect(
    (
      await app.request("/api/factory/calendar/frontier", {
        method: "PUT",
        headers: token,
        body: JSON.stringify({
          startsAt: day(0).toISOString(),
          endsAt: frontierSeasonEnd(day(0)),
        }),
      })
    ).status,
  ).toBe(200);
  expect((await app.request("/api/factory/calendar")).status).toBe(200);
});
test("only operator recovery continues a failed run in every format and results", async () => {
  const { app, store, armFor } = fixture();
  for (const [kind, request] of [
    ["game", { environment: "madara.blitz", gameName: "paid", slotId: 12, groupIndex: 0 }],
    ["game", { environment: "madara.frontier", gameName: "frontier-1" }],
    ["game", { environment: "madara.eternum", gameName: "old-factory" }],
    ["result", { environment: "madara.blitz", gameName: "paid", gameId: 1 }],
  ] as const) {
    const run = await store.enqueue(kind, request);
    await database.db.prepare("UPDATE launch_runs SET status='running' WHERE id=?").bind(run.id).run();
    await store.fail(run.id, "unavailable");
    const url = `/api/factory/${kind === "game" ? "runs" : "results"}/${request.environment}/${request.gameName}/actions/continue`;
    expect((await app.request(url, { method: "POST", headers: session })).status).toBe(403);
    expect((await store.find(kind, request.environment, request.gameName))!.status).toBe("failed");
    expect((await app.request(url, { method: "POST", headers: token })).status).toBe(202);
  }
  expect(armFor).toHaveBeenCalledTimes(4);
});
test("operator deletion refuses paid slots and allows an ordinary failed run", async () => {
  const { app, store } = fixture();
  await store.enqueue("game", { environment: "madara.blitz", gameName: "paid", slotId: 12, groupIndex: 0 });
  expect(
    (await app.request("/api/factory/runs/madara.blitz/paid/actions/delete", { method: "POST", headers: token }))
      .status,
  ).toBe(409);
  await store.enqueue("game", { environment: "madara.frontier", gameName: "frontier-1" });
  const url = "/api/factory/runs/madara.frontier/frontier-1/actions/delete";
  expect((await app.request(url, { method: "POST", headers: session })).status).toBe(403);
  expect((await app.request(url, { method: "POST", headers: token })).status).toBe(200);
});
test("operator refunds retain the ledger's retry boundary", async () => {
  const { app, slots, value } = fixture();
  await slots.create("friday", close());
  const refund = vi.spyOn(value, "refundSlot").mockResolvedValueOnce(60).mockResolvedValueOnce(null);
  expect((await app.request("/api/slots/friday/refund", { method: "POST", headers: token })).status).toBe(409);
  expect((await app.request("/api/slots/friday/refund", { method: "POST", headers: token })).status).toBe(200);
  expect(refund).toHaveBeenCalledWith({ chainId: TEST_CHAIN, slotId: 1 });
});
test("health and version remain public and identify the deployment", async () => {
  const { app } = fixture();
  for (const route of ["health", "version"])
    expect(await (await app.request(`/api/factory/${route}`)).json()).toMatchObject({
      service: "launch",
      environment: "staging",
      version: "test",
    });
});

test("public health names a failed join before any run has failed", async () => {
  const { app, joinFailures } = fixture();
  const failure = { chainId: TEST_CHAIN, code: "account_join_read_failed", checkedAt: 1000 };
  joinFailures.mockResolvedValue([failure]);
  const response = await app.request("/api/factory/health");
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ joinFailures: [failure], failedRuns: [] });
});

test("health forgets retired work but names an unarmed due run on the live chain", async () => {
  const { app, store, wakeAt } = fixture();
  const retired = new D1LaunchStore(database.db, testChain("0xdead"));
  await retired.enqueue("game", { environment: "madara.frontier", gameName: "old" });
  wakeAt.mockResolvedValue(null);
  expect((await app.request("/api/factory/health")).status).toBe(200);
  await store.enqueue("game", { environment: "madara.frontier", gameName: "live" });
  const stranded = await app.request("/api/factory/health");
  expect(stranded.status).toBe(503);
  expect(await stranded.json()).toMatchObject({ strandedRuns: [{ name: "live" }] });
  wakeAt.mockResolvedValue(0);
  expect((await app.request("/api/factory/health")).status).toBe(200);
  const running = (await store.startNext(Date.now()))!;
  await store.fail(running.id, "game_creation_failed");
  const failed = await app.request("/api/factory/health");
  expect(failed.status).toBe(503);
  expect(await failed.json()).toMatchObject({ failedRuns: [{ name: "live", error: "game_creation_failed" }] });
});

test("health names a stalled ledger close, preserves the failure through reads, and clears it when the cron retries", async () => {
  const { app, slots, value, store } = fixture();
  await slots.create("stalled", close());
  await database.db
    .prepare("UPDATE playtest_slots SET closes_at=?")
    .bind(Date.now() - 60_000)
    .run();
  const page = await value.registrations();
  const registrations = vi.spyOn(value, "registrations").mockResolvedValue({ ...page, secondsUntilClose: 492 });
  await slots.freezeDueSlots();
  expect((await slots.get("stalled")).frozenAt).toBeNull();
  expect(await store.list("madara.blitz")).toEqual([]);
  const health = await app.request("/api/factory/health");
  expect(health.status).toBe(503);
  expect(await health.json()).toMatchObject({
    freezeFailures: [
      {
        chainId: TEST_CHAIN,
        name: "stalled",
        code: "registration_open",
        secondsUntilClose: 492,
      },
    ],
  });
  expect(
    await new D1SlotStore(database.db, store, value, slotResolver(value, registrationIdentityFixture)).freezeFailures(),
  ).toHaveLength(1);
  registrations.mockResolvedValue(page);
  await slots.freezeDueSlots();
  expect((await slots.get("stalled")).frozenAt).not.toBeNull();
  expect(await store.list("madara.blitz")).toHaveLength(1);
  const recovered = await app.request("/api/factory/health");
  expect(recovered.status).toBe(200);
  expect(await recovered.json()).toMatchObject({ freezeFailures: [] });
});

test("health exposes fixed freeze codes but never private diagnostic text", async () => {
  const { app, slots, value } = fixture();
  await slots.create("failed", close());
  await database.db.prepare("UPDATE playtest_slots SET closes_at=0").run();
  vi.spyOn(value, "registrations").mockRejectedValue(new Error("registration_history_incomplete: Bearer secret-value"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await slots.freezeDueSlots();
  const health = await app.request("/api/factory/health");
  expect(health.status).toBe(503);
  const body = await health.text();
  expect(body).toContain('"code":"registration_history_incomplete"');
  expect(body).not.toContain("secret-value");
  expect(JSON.stringify(log.mock.calls)).not.toContain("secret-value");
});

const testBlitz = (app: ReturnType<typeof fixture>["app"], body: unknown) =>
  app.request("/api/factory/test-blitz", { method: "POST", headers: token, body: JSON.stringify(body) });

test("an operator queues a test Blitz on a dev shard with the named roster, starting one preparation window later", async () => {
  const { app, store, armFor } = fixture(DEV_CHAIN);
  const requestedAt = Date.now();
  const response = await testBlitz(app, { name: "test-hud", players: ["0x0ABC", "0x456"] });
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({ gameName: "test-hud", status: "queued" });
  const [run] = await store.list("madara.blitz");
  expect(run).toMatchObject({ chainId: DEV_CHAIN, slotId: null, name: "test-hud" });
  expect(run!.request).toMatchObject({ environment: "madara.blitz", players: ["0xabc", "0x456"] });
  const startsIn = Date.parse((run!.request as { gameStartTime: string }).gameStartTime) - requestedAt;
  expect(startsIn).toBeGreaterThanOrEqual(300_000);
  expect(startsIn).toBeLessThanOrEqual(301_000);
  expect(armFor).toHaveBeenCalledOnce();
});

test("a retry after a lost response returns the same run, and another roster under that name is refused", async () => {
  const { app, store } = fixture(DEV_CHAIN);
  const request = { name: "test-hud", players: ["0x456", "0x789"] };
  const first = (await (await testBlitz(app, request)).json()) as { runId: string };
  vi.useFakeTimers({ now: Date.now() + 120_000, toFake: ["Date"] });
  try {
    const retry = await testBlitz(app, request);
    expect(retry.status).toBe(202);
    expect(await retry.json()).toMatchObject({ runId: first.runId, gameName: "test-hud" });
    expect((await testBlitz(app, { ...request, players: ["0x789", "0x456"] })).status).toBe(409);
  } finally {
    vi.useRealTimers();
  }
  const runs = await store.list("madara.blitz");
  expect(runs).toHaveLength(1);
  expect(runs[0]!.request).toMatchObject({ players: ["0x456", "0x789"] });
});

test("a slot's game cannot be taken over by a test Blitz of the same name", async () => {
  const { app, store } = fixture(DEV_CHAIN);
  await store.enqueue("game", { environment: "madara.blitz", gameName: "test-x-1", slotId: 12, groupIndex: 0 });
  expect((await testBlitz(app, { name: "test-x-1", players: ["0x456"] })).status).toBe(409);
});

test("a Worker bound to a production shard has no test Blitz route, even configured as staging", async () => {
  const { app, store, armFor } = fixture(PRODUCTION_CHAIN);
  expect((await testBlitz(app, { name: "test-hud", players: ["0x456"] })).status).toBe(404);
  expect(await store.list("madara.blitz")).toEqual([]);
  expect(armFor).not.toHaveBeenCalled();
});

test.each([
  ["no players", { name: "test-hud", players: [] }],
  ["a repeated account", { name: "test-hud", players: ["0x456", "0x0456"] }],
  ["the zero account", { name: "test-hud", players: ["0x0"] }],
  ["a name instead of an account", { name: "test-hud", players: ["uxplay"] }],
  [
    "more than one game's roster",
    { name: "test-hud", players: Array.from({ length: 25 }, (_, index) => `0x${(index + 1).toString(16)}`) },
  ],
  ["no request name", { players: ["0x456"] }],
  ["a slot-style name", { name: "blitz-20261014-2000-1", players: ["0x456"] }],
  ["a name too long for the shard", { name: `test-${"a".repeat(27)}`, players: ["0x456"] }],
])("refuses a test Blitz request with %s", async (_case, body) => {
  const { app, store } = fixture(DEV_CHAIN);
  expect((await testBlitz(app, body)).status).toBe(400);
  expect(await store.list("madara.blitz")).toEqual([]);
});

const applyRelease = (app: ReturnType<typeof fixture>["app"], body: unknown) =>
  app.request("/api/factory/release", { method: "POST", headers: token, body: JSON.stringify(body) });

test("the release route answers the registrar's report for the release the deploy ships", async () => {
  const { app, applyRelease: registrar } = fixture();
  const report = {
    releaseId: 2,
    shards: [{ chainId: DEV_CHAIN, releaseId: 2, games: [{ gameId: 1, from: 1, to: 2, transactions: ["0xa"] }] }],
  };
  registrar.mockResolvedValueOnce(report);
  const response = await applyRelease(app, { releaseId: 2 });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(report);
  expect(registrar).toHaveBeenCalledWith(2);
});

test.each([[{}], [{ releaseId: 0 }], [{ releaseId: 1.5 }], [{ releaseId: "2" }], [null]])(
  "the release route refuses %j before the registrar signs anything",
  async (body) => {
    const { app, applyRelease: registrar } = fixture();
    const response = await applyRelease(app, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_release" });
    expect(registrar).not.toHaveBeenCalled();
  },
);

test.each(["release_not_registered", "release_older_than_shard", "release_unpublished", "release_downgrade"])(
  "the release route names the refusal %s",
  async (code) => {
    const { app, applyRelease: registrar } = fixture();
    registrar.mockRejectedValueOnce(new Error(code));
    const response = await applyRelease(app, { releaseId: 2 });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: code });
  },
);

test("an unexpected release failure is reported without its detail", async () => {
  const { app, applyRelease: registrar } = fixture();
  vi.spyOn(console, "error").mockImplementation(() => {});
  registrar.mockRejectedValueOnce(new Error("rpc https://secret.test failed"));
  const response = await applyRelease(app, { releaseId: 2 });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "release_apply_failed" });
});
