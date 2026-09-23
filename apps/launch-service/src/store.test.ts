import { afterEach, beforeEach, expect, test } from "vitest";
import { scheduleFrontierSeason } from "./schedule";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase } from "./test-database";

let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  await database.close();
});

const frontierSummary = (gameName: string, seasonStart: string) => ({
  environment: "madara.frontier" as const,
  chain: "madara" as const,
  gameType: "frontier" as const,
  gameName,
  gameId: 9,
  startTime: Date.parse(seasonStart) / 1000,
  startTimeIso: seasonStart,
  rpcUrl: "http://rpc.test",
  configMode: "batched" as const,
  configSteps: [],
  dryRun: false,
});

test("supports both launch formats and refuses an unknown environment", async () => {
  const store = new D1LaunchStore(database.db);
  const blitz = await store.enqueue("game", { environment: "madara.blitz", gameName: "existing-blitz" });
  const eternum = await store.enqueue("game", { environment: "madara.eternum", gameName: "new-eternum" });
  expect((await store.find("game", "madara.blitz", blitz.name))?.id).toBe(blitz.id);
  expect((await store.list("madara.eternum")).map((run) => run.id)).toEqual([eternum.id]);
  expect("version" in eternum.request && eternum.request.version).toBe("3");
  await expect(
    database.db.prepare("UPDATE launch_runs SET environment = 'unsupported' WHERE id = ?").bind(eternum.id).run(),
  ).rejects.toThrow("CHECK constraint failed");
});

test("creation and delayed finalization are one durable write and survive a restart", async () => {
  const store = new D1LaunchStore(database.db);
  const queued = await store.enqueue("game", { environment: "madara.blitz", gameName: "native-results" });
  const started = (await store.startNext(Date.now()))!;
  const summary = {
    environment: "madara.blitz" as const,
    chain: "madara" as const,
    gameType: "blitz" as const,
    gameName: queued.name,
    gameId: 7,
    startTime: 100,
    startTimeIso: "1970-01-01T00:01:40Z",
    rpcUrl: "http://rpc.test",
    configMode: "batched" as const,
    configSteps: [],
    dryRun: false,
    finalizeAt: Math.floor(Date.now() / 1_000) + 3_600,
  };
  await expect(store.complete(started.id, { ...summary, finalizeAt: undefined })).rejects.toThrow("schedule");
  expect((await store.find("game", "madara.blitz", queued.name))?.status).toBe("running");
  await store.complete(started.id, summary);

  const restarted = new D1LaunchStore(database.db);
  expect((await restarted.find("result", "madara.blitz", queued.name))?.request).toEqual({
    environment: "madara.blitz",
    gameName: queued.name,
    gameId: 7,
  });
  expect(await restarted.startNext(Date.now())).toBeNull();
  expect(await restarted.nextDue()).toBe(summary.finalizeAt * 1_000);
  const result = (await restarted.startNext(summary.finalizeAt * 1_000))!;
  expect(result.kind).toBe("result");
  await restarted.retry(result.id, "interrupted", 0);
  const recovered = (await restarted.startNext(summary.finalizeAt * 1_000))!;
  expect(recovered).toMatchObject({ id: result.id, attempts: 2 });
  await restarted.complete(recovered.id, {
    environment: "madara.blitz",
    gameName: queued.name,
    gameId: 7,
    resultCommitment: "0x123",
  });
  expect(await restarted.startNext(Number.MAX_SAFE_INTEGER)).toBeNull();
  expect(await restarted.list("madara.blitz")).toHaveLength(2);
});

test("a launch interrupted while running is resumed, not queued twice", async () => {
  const store = new D1LaunchStore(database.db);
  const queued = await store.enqueue("game", { environment: "madara.blitz", gameName: "interrupted" });
  expect((await store.startNext(Date.now()))?.id).toBe(queued.id);
  const resumed = await new D1LaunchStore(database.db).startNext(Date.now());
  expect(resumed).toMatchObject({ id: queued.id, status: "running", attempts: 2 });
  expect(await store.enqueue("game", { environment: "madara.blitz", gameName: "interrupted" })).toMatchObject({
    id: queued.id,
    status: "running",
  });
  expect(await store.list("madara.blitz")).toHaveLength(1);
});

test("one Frontier season is created once by every tick and continued like any failed run", async () => {
  const store = new D1LaunchStore(database.db);
  const seasonStart = "2027-01-01T00:00:00.000Z";
  const queued = await scheduleFrontierSeason(store, seasonStart);
  expect(queued.name).toBe("frontier-1798761600");
  expect(await scheduleFrontierSeason(store, seasonStart)).toMatchObject({ id: queued.id, status: "queued" });
  const run = (await store.startNext(Date.now()))!;
  expect(run.request).toMatchObject({ version: "1", gameStartTime: seasonStart });
  await store.retry(run.id, "rpc down", 60_000);
  // A tick while the season waits to retry must not reset its attempts or its delay.
  expect(await scheduleFrontierSeason(store, seasonStart)).toMatchObject({ attempts: 1, errorMessage: "rpc down" });
  expect(await store.startNext(Date.now())).toBeNull();

  await database.db.prepare("UPDATE launch_runs SET status = 'failed' WHERE id = ?").bind(run.id).run();
  expect(await scheduleFrontierSeason(store, seasonStart)).toMatchObject({ id: run.id, status: "failed" });
  const continued = await store.enqueue("game", run.request);
  expect(continued).toMatchObject({ name: queued.name, status: "queued", attempts: 0 });
  expect(continued.errorMessage).toBeUndefined();
  const retried = (await store.startNext(Date.now()))!;
  await store.complete(retried.id, frontierSummary(retried.name, seasonStart));
  expect(await scheduleFrontierSeason(store, seasonStart)).toMatchObject({ id: retried.id, status: "complete" });
  expect(await store.list("madara.frontier")).toHaveLength(1);

  const next = await scheduleFrontierSeason(store, "2027-04-30T00:00:00.000Z");
  expect(next.id).not.toBe(queued.id);
  expect((await store.startNext(Date.now()))?.id).toBe(next.id);
});
