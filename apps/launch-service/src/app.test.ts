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
} from "./test-database";

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
const fixture = () => {
  const store = new D1LaunchStore(database.db, testChain());
  const value = slotValueFixture(1);
  const slots = new D1SlotStore(database.db, store, value, registrationIdentityFixture);
  const calendar = new D1CalendarStore(database.db);
  const armFor = vi.fn();
  const joinFailures = vi.fn(async (): Promise<import("./registrar").JoinFailure[]> => []);
  const app = createLaunchApp({
    config: { operatorToken: "operator-test-token" },
    deployment: { environment: "staging", version: "test" },
    store,
    slots,
    calendar,
    registrar: { armFor, joinFailures },
  });
  return { app, store, slots, calendar, value, armFor, joinFailures };
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
