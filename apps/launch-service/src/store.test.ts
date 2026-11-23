import { D1CalendarStore } from "./calendar-store";
import { frontierSeasonEnd } from "./test-dates";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { scheduleFrontierSeason } from "./schedule";
import { D1LaunchStore } from "./store";
import { completeFreeFixture, createLaunchTestDatabase, testChain, TEST_CHAIN } from "./test-database";

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
  const store = new D1LaunchStore(database.db, testChain());
  const blitz = await store.enqueue({ environment: "madara.blitz", gameName: "existing-blitz" });
  const frontier = await store.enqueue({ environment: "madara.frontier", gameName: "new-frontier" });
  expect((await store.find("madara.blitz", blitz.name))?.id).toBe(blitz.id);
  expect((await store.list("madara.frontier")).map((run) => run.id)).toEqual([frontier.id]);
  await expect(
    database.db.prepare("UPDATE launch_runs SET environment = 'unsupported' WHERE id = ?").bind(frontier.id).run(),
  ).rejects.toThrow("CHECK constraint failed");
});

test("a stored Blitz result run is never started, listed or reported", async () => {
  const store = new D1LaunchStore(database.db, testChain());
  await database.db
    .prepare(
      `INSERT INTO launch_runs (id, chain_id, kind, environment, name, request, status, available_at, created_at, updated_at)
       VALUES ('stored-result', ?, 'result', 'madara.blitz', 'bltz-played', '{}', 'queued', 0, 0, 0)`,
    )
    .bind(await store.targetChain())
    .run();
  expect(await store.startNext(Date.now())).toBeNull();
  expect(await store.nextDue()).toBeNull();
  expect(await store.pending()).toEqual([]);
  expect(await store.list("madara.blitz")).toEqual([]);
  expect(await store.find("madara.blitz", "bltz-played")).toBeNull();
});

test("a launch interrupted while running is resumed, not queued twice", async () => {
  const store = new D1LaunchStore(database.db, testChain());
  const queued = await store.enqueue({ environment: "madara.blitz", gameName: "interrupted" });
  expect((await store.startNext(Date.now()))?.id).toBe(queued.id);
  const resumed = await new D1LaunchStore(database.db, testChain()).startNext(Date.now());
  expect(resumed).toMatchObject({ id: queued.id, status: "running", attempts: 2 });
  expect(await store.enqueue({ environment: "madara.blitz", gameName: "interrupted" })).toMatchObject({
    id: queued.id,
    status: "running",
  });
  expect(await store.list("madara.blitz")).toHaveLength(1);
});

const season = (startsAt: string) => ({
  phase: "frontier" as const,
  startsAt,
  endsAt: frontierSeasonEnd(startsAt),
});

test("one Frontier season is created once by every tick and continued like any failed run", async () => {
  const store = new D1LaunchStore(database.db, testChain());
  const seasonStart = "2027-01-01T00:00:00.000Z";
  await new D1CalendarStore(database.db).set(season(seasonStart), Date.parse(seasonStart) - 1);
  const queued = await scheduleFrontierSeason(store, season(seasonStart));
  expect(queued.name).toBe("frontier-1798761600");
  expect(await scheduleFrontierSeason(store, season(seasonStart))).toMatchObject({ id: queued.id, status: "queued" });
  const run = (await store.startNext(Date.now()))!;
  expect(run.request).toMatchObject({
    gameStartTime: seasonStart,
    durationSeconds: (Date.parse(frontierSeasonEnd(seasonStart)) - Date.parse(seasonStart)) / 1000,
  });
  await store.retry(run.id, "rpc down", 60_000);
  // A tick while the season waits to retry must not reset its attempts or its delay.
  expect(await scheduleFrontierSeason(store, season(seasonStart))).toMatchObject({
    attempts: 1,
    errorMessage: "rpc down",
  });
  expect(await store.startNext(Date.now())).toBeNull();

  await database.db.prepare("UPDATE launch_runs SET status = 'failed' WHERE id = ?").bind(run.id).run();
  expect(await scheduleFrontierSeason(store, season(seasonStart))).toMatchObject({ id: run.id, status: "failed" });
  const continued = await store.enqueue(run.request);
  expect(continued).toMatchObject({ name: queued.name, status: "queued", attempts: 0 });
  expect(continued.errorMessage).toBeUndefined();
  const retried = (await store.startNext(Date.now()))!;
  await completeFreeFixture(store, retried.id, frontierSummary(retried.name, seasonStart));
  expect(await scheduleFrontierSeason(store, season(seasonStart))).toMatchObject({
    id: retried.id,
    status: "complete",
  });
  expect(await store.list("madara.frontier")).toHaveLength(1);

  await new D1CalendarStore(database.db).set(season("2027-04-30T00:00:00.000Z"), Date.parse("2027-04-29T00:00:00Z"));
  const next = await scheduleFrontierSeason(store, season("2027-04-30T00:00:00.000Z"));
  expect(next.id).not.toBe(queued.id);
  expect((await store.startNext(Date.now()))?.id).toBe(next.id);
});

test("every game run's name is listed per environment and chain, whatever its state", async () => {
  const seasonStart = "2027-01-01T00:00:00.000Z";
  const chain = new D1LaunchStore(database.db, testChain("0x1"));
  const other = new D1LaunchStore(database.db, testChain("0x2"));
  await new D1CalendarStore(database.db).set(season(seasonStart), Date.parse(seasonStart) - 1);
  const done = await scheduleFrontierSeason(chain, season(seasonStart));
  await completeFreeFixture(chain, (await chain.startNext(Date.now()))!.id, frontierSummary(done.name, seasonStart));
  await new D1CalendarStore(database.db).set(season("2027-04-30T00:00:00.000Z"), Date.parse("2027-04-29T00:00:00Z"));
  const next = await scheduleFrontierSeason(chain, season("2027-04-30T00:00:00.000Z"));
  await chain.enqueue({ environment: "madara.blitz", gameName: "bltz-7" });
  const elsewhere = await scheduleFrontierSeason(other, season("2027-04-30T00:00:00.000Z"));
  expect((await chain.gameNames("madara.frontier")).sort()).toEqual([done.name, next.name].sort());
  expect(await other.gameNames("madara.frontier")).toEqual([elsewhere.name]);
});

test("retirement preserves history while unfinished live work remains observable", async () => {
  const seasonStart = "2027-01-01T00:00:00.000Z";
  const oldChain = new D1LaunchStore(database.db, testChain("0x1"));
  const launched = await oldChain.enqueue({ environment: "madara.blitz", gameName: "bltz-7" });
  const started = (await oldChain.startNext(Date.now()))!;
  await completeFreeFixture(oldChain, started.id, {
    ...frontierSummary(launched.name, seasonStart),
    environment: "madara.blitz",
    gameType: "blitz",
    gameId: 7,
  });
  await new D1CalendarStore(database.db).set(season(seasonStart), Date.parse(seasonStart) - 1);
  const oldSeason = await scheduleFrontierSeason(oldChain, season(seasonStart));

  const newChain = new D1LaunchStore(database.db, testChain("0x2"));
  expect(await newChain.playerDirectoryGames()).toEqual([
    { chainId: "0x1", games: [7].map((gameId) => ({ gameId, slotId: null })) },
  ]);
  expect(await newChain.startNext(Date.now())).toBeNull();
  expect(await newChain.pending()).toEqual([]);
  expect((await oldChain.pending()).map(({ chainId }) => chainId)).toEqual(["0x1"]);
  const frontier = (await oldChain.startNext(Date.now()))!;
  await completeFreeFixture(oldChain, frontier.id, frontierSummary(oldSeason.name, seasonStart));
  expect(await newChain.pending()).toEqual([]);
  expect(await newChain.list("madara.blitz")).toEqual([]);
  const newSeason = await scheduleFrontierSeason(newChain, season(seasonStart));
  expect(newSeason).toMatchObject({ name: oldSeason.name, chainId: "0x2", status: "queued" });
  expect(newSeason.id).not.toBe(oldSeason.id);
  const next = (await newChain.startNext(Date.now()))!;
  await completeFreeFixture(newChain, next.id, { ...frontierSummary(newSeason.name, seasonStart), gameId: 7 });
  expect(await newChain.playerDirectoryGames()).toEqual([
    { chainId: "0x1", games: [7, 9].map((gameId) => ({ gameId, slotId: null })) },
    { chainId: "0x2", games: [7].map((gameId) => ({ gameId, slotId: null })) },
  ]);
});

test("pre-chain migration archives neither block a cutover nor enter the directory", async () => {
  const store = new D1LaunchStore(database.db, testChain());
  const archived = await store.enqueue({ environment: "madara.blitz", gameName: "archive" });
  await database.db.prepare("UPDATE launch_runs SET chain_id = '' WHERE id = ?").bind(archived.id).run();
  expect(await store.pending()).toEqual([]);
  expect(await store.enqueue({ environment: "madara.blitz", gameName: "new" })).toMatchObject({
    status: "queued",
  });
  await database.db
    .prepare("UPDATE launch_runs SET status = 'complete', summary = ? WHERE id = ?")
    .bind(JSON.stringify({ gameId: 7 }), archived.id)
    .run();
  expect(await store.playerDirectoryGames()).toEqual([]);
});

test("a completed game, paid or free, cannot be deleted out of the directory", async () => {
  const store = new D1LaunchStore(database.db, testChain());
  await database.db.batch(
    [
      { name: "blitz-20261016-1400-1", slot: 3, gameId: 7 },
      { name: "free-game", slot: null, gameId: 9 },
    ].map(({ name, slot, gameId }) =>
      database.db
        .prepare(
          `INSERT INTO launch_runs (id, chain_id, kind, environment, name, request, status, available_at, created_at, updated_at, summary, slot_id) VALUES (?, ?, 'game', 'madara.blitz', ?, '{}', 'complete', 0, 0, 0, ?, ?)`,
        )
        .bind(name, TEST_CHAIN, name, JSON.stringify({ gameId }), slot),
    ),
  );
  expect(await store.delete("madara.blitz", "blitz-20261016-1400-1")).toBe(false);
  expect(await store.delete("madara.blitz", "free-game")).toBe(false);
  expect(await store.playerDirectoryGames()).toEqual([
    {
      chainId: TEST_CHAIN,
      games: [
        { gameId: 7, slotId: 3 },
        { gameId: 9, slotId: null },
      ],
    },
  ]);
});

test("directory reads retain both chains and log invalid summaries without reading a manifest", async () => {
  const malformed = [null, "{", "null", "[]", "{}", '{"gameId":-1}', '{"gameId":"7"}'];
  const rows = [
    { id: "first", chainId: "0x1", summary: '{"gameId":7}' },
    { id: "second", chainId: "0x2", summary: '{"gameId":9}' },
    { id: "dry", chainId: "0x1", summary: '{"dryRun":true}' },
    ...malformed.map((summary, index) => ({ id: `bad-${index}`, chainId: "0x1", summary })),
  ];
  await database.db.batch(
    rows.map(({ id, chainId, summary }) =>
      database.db
        .prepare(
          `INSERT INTO launch_runs (id, chain_id, kind, environment, name, request, status, available_at, created_at, updated_at, summary) VALUES (?, ?, 'game', 'madara.blitz', ?, '{}', 'complete', 0, 0, 0, ?)`,
        )
        .bind(id, chainId, id, summary),
    ),
  );
  const chainOf = vi.fn(async () => {
    throw new Error("manifest unavailable");
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    expect(await new D1LaunchStore(database.db, chainOf).playerDirectoryGames()).toEqual([
      { chainId: "0x1", games: [7].map((gameId) => ({ gameId, slotId: null })) },
      { chainId: "0x2", games: [9].map((gameId) => ({ gameId, slotId: null })) },
    ]);
    expect(chainOf).not.toHaveBeenCalled();
    expect(log.mock.calls.map(([, details]) => details.runId)).toEqual(malformed.map((_, index) => `bad-${index}`));
  } finally {
    log.mockRestore();
  }
});
