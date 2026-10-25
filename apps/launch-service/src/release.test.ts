import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { advanceGames, type ReleaseChain, type ReleaseIdentity } from "./release";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, testChain } from "./test-database";

const SCHEMA = "2fbdecd09f961d7b387524eef591d8a0185c2dea59c7c334560c9789a444149e";
const LOGIC = { season: "0x55e0", troops: "0x77a2", movement: "0x4de0" };

/** Release `releaseId` as the deployed commit's box build baked it. */
const candidate = (releaseId: number, changes: Partial<ReleaseIdentity> = {}): ReleaseIdentity => ({
  releaseId,
  schema: SCHEMA,
  logic: { ...LOGIC },
  migration: "0x0",
  ...changes,
});

/**
 * A shard on release `current` whose registered releases hold `registered` (the candidate's contents by default), its
 * games named `game-<id>` and pinned as `pins` (settled ones marked), recording every release it applies.
 */
type Registered = { logic: Record<string, string>; migration: string };

function shard(
  current: number,
  pins: Record<number, number>,
  { settled = [] as number[], registered = { logic: { ...LOGIC }, migration: "0x0" } as Registered } = {},
) {
  const applied: [number, number][] = [];
  const chain: ReleaseChain = {
    currentRelease: async () => current,
    registeredRelease: async () => registered,
    gameId: async (name) => (pins[Number(name.replace("game-", ""))] === undefined ? 0 : Number(name.slice(5))),
    gameRelease: async (gameId) => pins[gameId]!,
    isSettled: async (gameId) => settled.includes(gameId),
    applyRelease: async (gameId, releaseId) => {
      if (releaseId !== pins[gameId]! + 1) throw new Error("release must follow game pin");
      pins[gameId] = releaseId;
      applied.push([gameId, releaseId]);
      return `0x${gameId}${releaseId}`;
    },
  };
  return { chain, applied, pins };
}

const published = (...releases: number[]) => ({
  releaseSchemas: Object.fromEntries(releases.map((release) => [String(release), SCHEMA])),
});

test("a running Frontier game on release 1 takes release 2 once it is registered and published", async () => {
  const { chain, applied } = shard(2, { 1: 1 });
  expect(await advanceGames(chain, published(1, 2), candidate(2), ["game-1"])).toEqual([
    { gameId: 1, from: 1, to: 2, transactions: ["0x12"] },
  ]);
  expect(applied).toEqual([[1, 2]]);
});

test("a rerun on games already at the release sends nothing", async () => {
  const { chain, applied } = shard(2, { 1: 2 });
  expect(await advanceGames(chain, published(1, 2), candidate(2), ["game-1"])).toEqual([
    { gameId: 1, from: 2, to: 2, transactions: [] },
  ]);
  expect(applied).toEqual([]);
});

test("a game two releases behind advances one release at a time, in order", async () => {
  const { chain, applied } = shard(3, { 1: 1 });
  await advanceGames(chain, published(1, 2, 3), candidate(3), ["game-1"]);
  expect(applied).toEqual([
    [1, 2],
    [1, 3],
  ]);
});

test("a settled game keeps its pin, and a name never created on the chain is skipped", async () => {
  const { chain, applied } = shard(2, { 1: 1, 4: 1 }, { settled: [4] });
  const advanced = await advanceGames(chain, published(1, 2), candidate(2), ["game-1", "game-4", "game-9"]);
  expect(advanced.map(({ gameId }) => gameId)).toEqual([1]);
  expect(applied).toEqual([[1, 2]]);
});

test.each([
  ["before the box half registers the release", shard(1, { 1: 1 }), candidate(2), "release_not_registered"],
  ["an older commit, over a newer registered release", shard(3, { 1: 3 }), candidate(2), "release_older_than_shard"],
  [
    "the same release number registered with other logic",
    shard(2, { 1: 1 }, { registered: { logic: { ...LOGIC, movement: "0x456" }, migration: "0x0" } }),
    candidate(2),
    "release_contents_differ",
  ],
  [
    "the same release number registered with another migration",
    shard(2, { 1: 1 }, { registered: { logic: { ...LOGIC }, migration: "0x99" } }),
    candidate(2),
    "release_contents_differ",
  ],
  [
    "a registered release missing one of the commit's logic classes",
    shard(2, { 1: 1 }, { registered: { logic: { season: LOGIC.season, troops: LOGIC.troops }, migration: "0x0" } }),
    candidate(2),
    "release_contents_differ",
  ],
])("%s: refused, nothing sent", async (_case, { chain, applied }, release, refusal) => {
  await expect(advanceGames(chain, published(1, 2, 3), release, ["game-1"])).rejects.toThrow(refusal);
  expect(applied).toEqual([]);
});

test.each([
  ["Herald still serves only release 1", { releaseSchemas: { "1": SCHEMA } }],
  ["Herald maps the pin's release to another schema", { releaseSchemas: { "1": "0".repeat(64), "2": SCHEMA } }],
  [
    "Herald maps every release, uniformly, to another schema",
    { releaseSchemas: { "1": "f".repeat(64), "2": "f".repeat(64) } },
  ],
])("%s: refused, nothing sent", async (_case, herald) => {
  const { chain, applied } = shard(2, { 1: 1 });
  await expect(advanceGames(chain, herald, candidate(2), ["game-1"])).rejects.toThrow("release_unpublished");
  expect(applied).toEqual([]);
});

test("a game pinned past the release is refused, and no other game moves", async () => {
  const { chain, applied } = shard(2, { 1: 1, 2: 3 });
  await expect(advanceGames(chain, published(1, 2, 3), candidate(2), ["game-1", "game-2"])).rejects.toThrow(
    "release_downgrade",
  );
  expect(applied).toEqual([]);
});

/** The launch store as the registrar reads it, after a restart, beside a chain holding what the launches created. */
describe("interrupted Frontier launches", () => {
  let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
  beforeEach(async () => {
    database = await createLaunchTestDatabase();
  });
  afterEach(async () => {
    await database.close();
  });

  const created = (gameName: string, gameId: number) => ({
    environment: "madara.frontier" as const,
    chain: "madara" as const,
    gameType: "frontier" as const,
    gameName,
    gameId,
    startTime: 100,
    startTimeIso: "1970-01-01T00:01:40.000Z",
    rpcUrl: "https://rpc.test",
    configMode: "batched" as const,
    configSteps: [],
    dryRun: false,
  });

  /** A chain whose games are the launches' names; every game sits on release 1. */
  function chainOf(games: Record<string, number>) {
    const pins = new Map(Object.values(games).map((gameId) => [gameId, 1]));
    const applied: [number, number][] = [];
    const chain: ReleaseChain = {
      currentRelease: async () => 2,
      registeredRelease: async () => ({ logic: { ...LOGIC }, migration: "0x0" }),
      gameId: async (name) => games[name] ?? 0,
      gameRelease: async (gameId) => pins.get(gameId)!,
      isSettled: async () => false,
      applyRelease: async (gameId, releaseId) => {
        pins.set(gameId, releaseId);
        applied.push([gameId, releaseId]);
        return "0x1";
      },
    };
    return { chain, applied };
  }

  test.each([
    ["before its summary was written", false],
    ["after its summary was written, before the run completed", true],
  ])("a Frontier game created by a launch interrupted %s is advanced", async (_case, summaryWritten) => {
    const store = new D1LaunchStore(database.db, testChain());
    const run = await store.enqueue("game", { environment: "madara.frontier", gameName: "frontier-interrupted" });
    await store.startNext(Date.now());
    if (summaryWritten) await store.saveGame(created(run.name, 7));
    const restarted = new D1LaunchStore(database.db, testChain());
    expect((await restarted.find("game", "madara.frontier", run.name))?.status).toBe("running");
    const { chain, applied } = chainOf({ [run.name]: 7 });
    const advanced = await advanceGames(
      chain,
      published(1, 2),
      candidate(2),
      await restarted.gameNames("madara.frontier"),
    );
    expect(advanced).toEqual([{ gameId: 7, from: 1, to: 2, transactions: ["0x1"] }]);
    expect(applied).toEqual([[7, 2]]);
  });

  test("a queued Frontier launch that created nothing, and every Blitz game, stay out", async () => {
    const store = new D1LaunchStore(database.db, testChain());
    const blitz = await store.enqueue("game", { environment: "madara.blitz", gameName: "bltz-3" });
    const queued = await store.enqueue("game", { environment: "madara.frontier", gameName: "frontier-next" });
    const names = await store.gameNames("madara.frontier");
    expect(names).toEqual([queued.name]);
    const { chain, applied } = chainOf({ [blitz.name]: 3 });
    expect(await advanceGames(chain, published(1, 2), candidate(2), names)).toEqual([]);
    expect(applied).toEqual([]);
  });
});
