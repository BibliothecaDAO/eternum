import { day, frontierSeasonEnd } from "./test-dates";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createLaunchApp } from "./app";
import { D1LaunchStore } from "./store";
import { D1SlotStore } from "./slot-store";
import { D1CalendarStore } from "./calendar-store";
import { createLaunchTestDatabase, testChain, slotValueFixture, TEST_CHAIN, DEV_CHAIN } from "./test-database";
import type { ReleaseIdentity, ReleaseReport } from "./release";
import type { RegisteredShard } from "@realms-world/value-ledger";
import { serviceDependencies } from "@realms-world/chain";

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
const fixture = (chain = TEST_CHAIN, environment = "staging") => {
  const store = new D1LaunchStore(database.db, testChain(chain));
  const value = slotValueFixture();
  const slots = new D1SlotStore(database.db, store, value);
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
    deployment: { environment, version: "test", revision: "abc1234" },
    store,
    slots,
    calendar,
    registrar: { armFor, joinFailure, wakeAt, applyRelease },
  });
  return { app, store, slots, calendar, value, armFor, joinFailure, wakeAt, applyRelease };
};
const close = () => new Date(Math.floor(Date.now() / 1000) * 1000 + 60000).toISOString();
const openedSlot = (name: string, closesAt: string) =>
  database.db
    .prepare("INSERT INTO playtest_slots (name, closes_at, chain_id) VALUES (?, ?, ?)")
    .bind(name, Date.parse(closesAt), TEST_CHAIN)
    .run();
test("the create-run, slot-opening and launcher-discovery routes are gone even for the operator", async () => {
  const { app, store, slots } = fixture();
  expect((await app.request("/api/factory/launcher")).status).toBe(404);
  const opening = { method: "POST", headers: token, body: JSON.stringify({ name: "friday", closesAt: close() }) };
  expect((await app.request("/api/slots", opening)).status).toBe(404);
  expect(await slots.list()).toEqual([]);
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
  ["POST", "/api/slots/friday/refund"],
  ["PUT", "/api/factory/calendar/frontier"],
  ["POST", "/api/factory/runs/madara.frontier/frontier-7/actions/continue"],
  ["POST", "/api/factory/runs/madara.frontier/old/actions/delete"],
  ["POST", "/api/factory/release"],
  ["POST", "/api/factory/testnet-games"],
])("requires an operator token for %s %s", async (method, url) => {
  const { app } = fixture();
  for (const headers of [session, {}, { authorization: "Bearer wrong" }] as Record<string, string>[])
    expect((await app.request(url, { method, headers, body: "{}" })).status).toBe(403);
});
test("public discovery reads an opened slot under its shard key", async () => {
  const { app, slots } = fixture();
  const closesAt = close();
  await openedSlot("friday", closesAt);
  const found = await app.request("/api/slots/friday");
  expect(await found.json()).toMatchObject({ chainId: TEST_CHAIN, name: "friday", closesAt });
  expect(found.headers.get("cache-control")).toBe("no-store");
  vi.spyOn(slots, "list").mockRejectedValue(new Error("no scan"));
  expect((await app.request("/api/slots/friday")).status).toBe(200);
  expect((await app.request("/api/slots/missing")).status).toBe(404);
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
test("only operator recovery continues a failed run in every format", async () => {
  const { app, store, armFor } = fixture();
  for (const request of [
    { environment: "madara.blitz", gameName: "blitz-fixture" },
    { environment: "madara.frontier", gameName: "frontier-fixture" },
    { environment: "madara.frontier", gameName: "old-factory" },
  ] as const) {
    const run = await store.enqueue(request);
    await database.db.prepare("UPDATE launch_runs SET status='running' WHERE id=?").bind(run.id).run();
    await store.fail(run.id, "unavailable");
    const url = `/api/factory/runs/${request.environment}/${request.gameName}/actions/continue`;
    expect((await app.request(url, { method: "POST", headers: session })).status).toBe(403);
    expect((await store.find(request.environment, request.gameName))!.status).toBe("failed");
    expect((await app.request(url, { method: "POST", headers: token })).status).toBe(202);
  }
  expect(armFor).toHaveBeenCalledTimes(3);
});
test("only the operator deletes an ordinary queued run", async () => {
  const { app, store } = fixture();
  await store.enqueue({ environment: "madara.frontier", gameName: "frontier-fixture" });
  const url = "/api/factory/runs/madara.frontier/frontier-fixture/actions/delete";
  expect((await app.request(url, { method: "POST", headers: session })).status).toBe(403);
  expect((await app.request(url, { method: "POST", headers: token })).status).toBe(200);
});
test("operator refunds retain the ledger's retry boundary", async () => {
  const { app, value } = fixture();
  await openedSlot("friday", close());
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

test("health names the dependency it could not read, and every dependency when all read", async () => {
  const { app, joinFailure } = fixture();
  const healthy = await app.request("/api/factory/health");
  expect(healthy.status).toBe(200);
  expect(serviceDependencies((await healthy.json()) as { dependencies?: unknown })).toEqual([
    { name: "store", ok: true, code: null },
    { name: "registrar", ok: true, code: null },
  ]);
  joinFailure.mockRejectedValue(new Error("Durable Object reset at https://internal.test/key"));
  const failing = await app.request("/api/factory/health");
  expect(failing.status).toBe(503);
  const body = (await failing.json()) as { dependencies?: unknown; failedRuns?: unknown };
  expect(body.failedRuns).toBeUndefined();
  expect(JSON.stringify(body)).not.toContain("internal.test");
  expect(serviceDependencies(body)).toEqual([
    { name: "store", ok: true, code: null },
    { name: "registrar", ok: false, code: "registrar_unavailable" },
  ]);
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
  const app = createLaunchApp({
    config: { operatorToken: "operator-test-token" },
    deployment: { environment: "staging", version: "test", revision: "abc1234" },
    store,
    slots: new D1SlotStore(database.db, store, slotValueFixture()),
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
  await retired.enqueue({ environment: "madara.frontier", gameName: "old" });
  wakeAt.mockResolvedValue(null);
  expect((await app.request("/api/factory/health")).status).toBe(200);
  await store.enqueue({ environment: "madara.frontier", gameName: "live" });
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

const testnet = (body: object) => ({ method: "POST", headers: token, body: JSON.stringify(body) });
const FINAL_TESTNET = { startsAt: "2026-11-24T12:00:00Z", endsAt: "2026-12-01T23:58:00Z" };

test("production queues the final testnet: a real-speed Frontier game named testnet-<start>, which is not the season", async () => {
  const { app, store, armFor } = fixture(TEST_CHAIN, "production");
  const response = await app.request("/api/factory/testnet-games", testnet(FINAL_TESTNET));
  expect(response.status).toBe(202);
  const [run] = await store.list("madara.frontier");
  expect(run!.request).toEqual({
    environment: "madara.frontier",
    gameName: "testnet-1795521600",
    gameStartTime: "2026-11-24T12:00:00.000Z",
    durationSeconds: 647_880,
    devModeOn: false,
  });
  expect(armFor).toHaveBeenCalled();
});

test("a repeated testnet call lands on the same run, and another end for the same start is refused", async () => {
  const { app, store } = fixture(TEST_CHAIN, "production");
  expect((await app.request("/api/factory/testnet-games", testnet(FINAL_TESTNET))).status).toBe(202);
  expect((await app.request("/api/factory/testnet-games", testnet(FINAL_TESTNET))).status).toBe(202);
  const moved = await app.request(
    "/api/factory/testnet-games",
    testnet({ ...FINAL_TESTNET, endsAt: "2026-12-01T22:00:00Z" }),
  );
  expect(moved.status).toBe(409);
  expect(await store.list("madara.frontier")).toHaveLength(1);
});

test("a testnet end off the 120 s tick is refused before anything is queued", async () => {
  const { app, store } = fixture(TEST_CHAIN, "production");
  const response = await app.request(
    "/api/factory/testnet-games",
    testnet({ ...FINAL_TESTNET, endsAt: "2026-12-01T23:59:00Z" }),
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "A Frontier season ends on a 120 s tick" });
  expect(await store.list("madara.frontier")).toEqual([]);
});

test("staging queues a 4x rehearsal in dev mode on 30 s ticks; production refuses any speed but 1", async () => {
  const staging = fixture();
  const rehearsal = { startsAt: "2026-11-24T12:00:30Z", endsAt: "2026-11-25T12:00:30Z", speed: 4 };
  expect((await staging.app.request("/api/factory/testnet-games", testnet(rehearsal))).status).toBe(202);
  const [run] = await staging.store.list("madara.frontier");
  expect(run!.request).toMatchObject({
    gameName: "testnet-1795521630",
    speed: 4,
    devModeOn: true,
    durationSeconds: 86_400,
  });
  const production = fixture(DEV_CHAIN, "production");
  const refused = await production.app.request("/api/factory/testnet-games", testnet(rehearsal));
  expect(refused.status).toBe(403);
  expect(await refused.json()).toEqual({ error: "testnet_speed_staging_only" });
  expect(await production.store.list("madara.frontier")).toEqual([]);
});

test("a testnet call without dates is refused", async () => {
  const { app } = fixture();
  const response = await app.request("/api/factory/testnet-games", testnet({ speed: 1 }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid_testnet" });
});
