import { Effect } from "effect";
import { afterEach, beforeEach, expect, test } from "vitest";
import { nextBlitzSlot, runLaunchSchedule } from "./schedule";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase } from "./test-database";

let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  await database.close();
});

const closeSlots = () =>
  database.db
    .prepare("UPDATE playtest_slots SET closes_at = ?")
    .bind(Date.now() - 1_000)
    .run();

test("registration and frozen groups survive concurrency, an interrupted freeze and a restart", async () => {
  const launches = new D1LaunchStore(database.db);
  const slots = new D1SlotStore(database.db);
  const closesAt = new Date(Date.now() + 60_000).toISOString();
  await slots.create("friday", closesAt);
  await slots.create("friday", new Date(Date.now() + 120_000).toISOString());
  expect((await slots.list()).map((slot) => slot.closesAt)).toEqual([closesAt]);
  await expect(slots.freeze("friday")).rejects.toThrow("still open");
  for (let index = 1; index <= 25; index++) await slots.register("friday", `0x${index.toString(16)}`);
  await Promise.all(Array.from({ length: 10 }, () => slots.register("friday", "0x01")));
  const [registered] = await slots.list();
  expect(registered!.registrations.map(({ owner }) => owner)).toEqual(
    Array.from({ length: 25 }, (_, index) => `0x${(index + 1).toString(16)}`),
  );
  expect(registered!.registrations.every(({ gameNumber }) => gameNumber === null)).toBe(true);
  await closeSlots();
  await expect(slots.register("friday", "0x26")).rejects.toThrow("closed");

  await database.db
    .prepare(
      `CREATE TRIGGER interrupt_freeze BEFORE UPDATE OF frozen_at ON playtest_slots
       BEGIN SELECT RAISE(ABORT, 'freeze interrupted'); END`,
    )
    .run();
  await expect(slots.freeze("friday")).rejects.toThrow("freeze interrupted");
  const [interrupted] = await slots.list();
  expect(interrupted!.frozenAt).toBeNull();
  expect(interrupted!.registrations.every(({ gameNumber }) => gameNumber === null)).toBe(true);
  expect(await launches.list("madara.blitz")).toEqual([]);
  await database.db.prepare("DROP TRIGGER interrupt_freeze").run();

  const [first, second] = await Promise.all([slots.freeze("friday"), slots.freeze("friday")]);
  expect(first).toEqual(second);
  expect(first.registrations.map(({ gameNumber }) => gameNumber)).toEqual([...Array(13).fill(1), ...Array(12).fill(2)]);
  const queued = await launches.list("madara.blitz", "game");
  expect(queued.map(({ name }) => name).sort()).toEqual(["friday-1", "friday-2"]);
  for (const run of queued) {
    expect(run.request).toMatchObject({ version: "2", devModeOn: false, singleRealmMode: false });
    expect(run.status).toBe("queued");
    expect("rosterOwners" in run.request && run.request.rosterOwners).toEqual(
      first.registrations.filter(({ gameNumber }) => run.name === `friday-${gameNumber}`).map(({ owner }) => owner),
    );
  }

  const restarted = new D1SlotStore(database.db);
  expect(await restarted.freeze("friday")).toEqual(first);
  expect(await restarted.list()).toEqual([first]);
  expect((await launches.list("madara.blitz", "game")).map(({ id }) => id).sort()).toEqual(
    queued.map(({ id }) => id).sort(),
  );
  await expect(restarted.register("friday", "0x1")).rejects.toThrow("closed");
});

test("every tick names the same next slot and a frozen slot is pruned when the next one freezes", async () => {
  const launches = new D1LaunchStore(database.db);
  const slots = new D1SlotStore(database.db);
  const tick = (now: Date) => Effect.runPromise(runLaunchSchedule(launches, slots, undefined, now));
  const now = new Date("2026-10-01T11:30:00Z");
  await Promise.all([tick(now), tick(now), tick(now)]);
  expect((await slots.list()).map(({ name, closesAt }) => ({ name, closesAt }))).toEqual([
    { name: "blitz-20261001-2000", closesAt: "2026-10-01T20:00:00.000Z" },
  ]);
  expect(nextBlitzSlot(new Date("2026-10-01T20:00:00Z"))).toEqual({
    name: "blitz-20261002-1100",
    closesAt: "2026-10-02T11:00:00.000Z",
  });

  await database.db
    .prepare("UPDATE playtest_slots SET closes_at = ?")
    .bind(Date.now() + 60_000)
    .run();
  await slots.register("blitz-20261001-2000", "0x1");
  await closeSlots();
  await slots.freezeNextDue();
  await tick(new Date("2026-10-01T20:00:01Z"));
  await closeSlots();
  await slots.freezeNextDue();
  expect((await slots.list()).map(({ name, frozenAt }) => ({ name, frozen: frozenAt !== null }))).toEqual([
    { name: "blitz-20261002-1100", frozen: true },
  ]);
  expect((await launches.list("madara.blitz", "game")).map(({ name }) => name)).toEqual(["blitz-20261001-2000-1"]);
});

test("the schedule freezes zero and single-player slots without inventing players", async () => {
  const launches = new D1LaunchStore(database.db);
  const slots = new D1SlotStore(database.db);
  const closesAt = new Date(Date.now() + 60_000).toISOString();
  await slots.create("empty", closesAt);
  await slots.create("solo", closesAt);
  await slots.register("solo", "0x123");
  await closeSlots();
  await slots.freezeNextDue();
  expect((await slots.list()).map(({ name, frozenAt }) => [name, frozenAt !== null])).toEqual([
    ["empty", true],
    ["solo", false],
  ]);
  await slots.freezeNextDue();
  await slots.freezeNextDue();
  const [solo, ...others] = await slots.list();
  expect(others).toEqual([]);
  expect(solo!.frozenAt).not.toBeNull();
  expect(solo!.registrations).toMatchObject([{ owner: "0x123", gameNumber: 1 }]);
  expect((await launches.list("madara.blitz", "game")).map(({ name }) => name)).toEqual(["solo-1"]);
});
