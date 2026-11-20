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
} from "./test-database";
import type { ReleaseIdentity, ReleaseReport } from "./release";
import type { RegisteredShard } from "@realms-world/value-ledger";

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
  const joinFailure = vi.fn(async (): Promise<import("./registrar").JoinFailure | null> => null);
  const applyRelease = vi.fn(
    async (_release: ReleaseIdentity | null, _shard: RegisteredShard | null): Promise<ReleaseReport> => ({
      shard: null,
    }),
  );
  const app = createLaunchApp({
    config: { operatorToken: "operator-test-token" },
    deployment: { environment: "staging", version: "test", revision: "abc1234" },
    store,
    slots,
    calendar,
    registrar: { armFor, joinFailure, wakeAt, applyRelease },
  });
  return { app, store, slots, calendar, value, armFor, joinFailure, wakeAt, applyRelease };
};
const close = () => new Date(Math.floor(Date.now() / 1000) * 1000 + 60000).toISOString();
test("the create-run and launcher-discovery routes are gone even for the operator", async () => {
  const { app, store } = fixture();
  expect((await app.request("/api/factory/launcher")).status).toBe(404);
  expect((await app.request("/api/factory/operator/launcher/enrol", { method: "POST", headers: token })).status).toBe(
    404,
  );
  for (const environment of ["madara.frontier", "madara.blitz"]) {
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
  ["POST", "/api/factory/runs/madara.frontier/old/actions/delete"],
  ["POST", "/api/factory/results/madara.blitz/old/actions/continue"],
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
          presetId: 5,
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
    ["game", { environment: "madara.frontier", gameName: "frontier-fixture" }],
    ["game", { environment: "madara.frontier", gameName: "old-factory" }],
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
  await store.enqueue("game", { environment: "madara.frontier", gameName: "frontier-fixture" });
  const url = "/api/factory/runs/madara.frontier/frontier-fixture/actions/delete";
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
  const { app, joinFailure } = fixture();
  const failure = { chainId: TEST_CHAIN, code: "account_join_read_failed", checkedAt: 1000 };
  joinFailure.mockResolvedValue(failure);
  const response = await app.request("/api/factory/health");
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ joinFailure: failure, failedRuns: [] });
});

test("health answers healthy and empty before the directory lists any chain", async () => {
  const store = new D1LaunchStore(database.db, async () => null);
  const value = slotValueFixture(1);
  const app = createLaunchApp({
    config: { operatorToken: "operator-test-token" },
    deployment: { environment: "staging", version: "test", revision: "abc1234" },
    store,
    slots: new D1SlotStore(database.db, store, value, slotResolver(value, registrationIdentityFixture)),
    calendar: new D1CalendarStore(database.db),
    registrar: { armFor: vi.fn(), joinFailure: async () => null, wakeAt: async () => 0, applyRelease: vi.fn() },
  });
  const response = await app.request("/api/factory/health");
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ failedRuns: [], strandedRuns: [], joinFailure: null });
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

const applyRelease = (app: ReturnType<typeof fixture>["app"], body: unknown) =>
  app.request("/api/factory/release", { method: "POST", headers: token, body: JSON.stringify(body) });
const RELEASE = {
  releaseId: 2,
  schema: "2fbdecd09f961d7b387524eef591d8a0185c2dea59c7c334560c9789a444149e",
  logic: { season: "0x55e0", troops: "0x77a2" },
  migration: "0x0",
};
const SHARD = { chainId: DEV_CHAIN, url: "https://herald.dev.test" };

test("the release route hands the commit's release to the registrar and answers its report", async () => {
  const { app, applyRelease: registrar } = fixture();
  const report = {
    shard: {
      chainId: DEV_CHAIN,
      releaseId: 2,
      games: [{ gameId: 1, from: 1, to: 2, transactions: ["0xa"] }],
      opened: ["0xb"],
    },
  };
  registrar.mockResolvedValueOnce(report);
  const response = await applyRelease(app, { release: RELEASE, shard: SHARD });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(report);
  expect(registrar).toHaveBeenCalledWith(RELEASE, SHARD);
});

test("a deployment whose box never built sends no release and no shard", async () => {
  const { app, applyRelease: registrar } = fixture();
  expect((await applyRelease(app, { release: null, shard: null })).status).toBe(200);
  expect(registrar).toHaveBeenCalledWith(null, null);
});

test.each([
  [{}],
  [null],
  [{ releaseId: 2 }],
  [{ release: { ...RELEASE, releaseId: 0 } }],
  [{ release: { ...RELEASE, schema: "0x2fbd" } }],
  [{ release: { ...RELEASE, logic: {} } }],
  [{ release: { ...RELEASE, logic: { season: "season" } } }],
  [{ release: { ...RELEASE, migration: undefined }, shard: SHARD }],
  [{ release: RELEASE }],
  [{ release: RELEASE, shard: { chainId: DEV_CHAIN } }],
])("the release route refuses %j before the registrar signs anything", async (body) => {
  const { app, applyRelease: registrar } = fixture();
  const response = await applyRelease(app, body);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid_release" });
  expect(registrar).not.toHaveBeenCalled();
});

test.each([
  "release_unverified",
  "release_not_registered",
  "release_older_than_shard",
  "release_contents_differ",
  "release_unpublished",
  "release_downgrade",
])("the release route names the refusal %s", async (code) => {
  const { app, applyRelease: registrar } = fixture();
  registrar.mockRejectedValueOnce(new Error(code));
  const response = await applyRelease(app, { release: RELEASE, shard: SHARD });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: code });
});

test("an unexpected release failure is reported without its detail", async () => {
  const { app, applyRelease: registrar } = fixture();
  vi.spyOn(console, "error").mockImplementation(() => {});
  registrar.mockRejectedValueOnce(new Error("rpc https://secret.test failed"));
  const response = await applyRelease(app, { release: RELEASE, shard: SHARD });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "release_apply_failed" });
});
