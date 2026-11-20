import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { advanceGames, openForNewGames, type ReleaseChain, type ReleaseIdentity } from "./release";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, testChain } from "./test-database";
import { releaseLine } from "../../../packages/core/src/test-support/releases";

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

type Registered = { logic: string[]; migration: string };
const FRONTIER = 1;
const BLITZ = 2;

function shard(
  latest: number,
  pins: Record<number, number>,
  {
    settled = [] as number[],
    registered = { logic: Object.values(LOGIC), migration: "0x0" } as Registered,
    blitz = [] as number[],
    blitzGames = [] as number[],
  } = {},
) {
  const applied: [number, number][] = [];
  const opened: number[] = [];
  const familyOf = (releaseId: number) => (blitz.includes(releaseId) ? BLITZ : FRONTIER);
  const latestOf = (family: number, below = latest + 1) =>
    Math.max(0, ...Array.from({ length: below - 1 }, (_, index) => index + 1).filter((id) => familyOf(id) === family));
  const previousOf = (releaseId: number) => latestOf(familyOf(releaseId), releaseId);
  const open = { [FRONTIER]: latestOf(FRONTIER, 2), [BLITZ]: 0 } as Record<number, number>;
  const chain: ReleaseChain = {
    openReleaseOf: async (family) => open[family]!,
    latestReleaseOf: async (family) => latestOf(family),
    releaseRegistered: async (releaseId) => releaseId >= 1 && releaseId <= latest,
    openRelease: async (releaseId) => {
      if (previousOf(releaseId) !== open[familyOf(releaseId)]) throw new Error("release must follow the open release");
      open[familyOf(releaseId)] = releaseId;
      opened.push(releaseId);
      return `0x${releaseId}`;
    },
    registeredRelease: async (releaseId) => ({
      ...(releaseId === latest ? registered : { logic: Object.values(LOGIC), migration: "0x0" }),
      family: familyOf(releaseId),
      previous: previousOf(releaseId),
    }),
    gameId: async (name) => (pins[Number(name.replace("game-", ""))] === undefined ? 0 : Number(name.slice(5))),
    gameRelease: async (gameId) => pins[gameId]!,
    game: async (gameId) => ({
      settled: settled.includes(gameId),
      family: BigInt(blitzGames.includes(gameId) ? BLITZ : FRONTIER),
    }),
    applyRelease: async (gameId, releaseId) => {
      if (previousOf(releaseId) !== pins[gameId]) throw new Error("release must follow game pin");
      pins[gameId] = releaseId;
      applied.push([gameId, releaseId]);
      return `0x${gameId}${releaseId}`;
    },
  };
  return { chain, applied, pins, opened };
}

const published = (...releases: number[]) => ({ releases: releaseLine(SCHEMA, releases) });

test("a running Frontier game on release 1 takes release 2 once it is registered and published", async () => {
  const { chain, applied } = shard(2, { 1: 1 });
  expect(await advanceGames(chain, published(1, 2), candidate(2), ["game-1"])).toEqual([
    { gameId: 1, from: 1, to: 2, transactions: ["0x12"] },
  ]);
  expect(applied).toEqual([[1, 2]]);
});

test("advancing the running games leaves the release closed to new games", async () => {
  const { chain, opened } = shard(2, { 1: 1 });
  await advanceGames(chain, published(1, 2), candidate(2), ["game-1"]);
  expect(await chain.openReleaseOf(FRONTIER)).toBe(1);
  expect(opened).toEqual([]);
});

test("opening for new games walks every staged release in order, and a rerun sends nothing", async () => {
  const { chain, opened } = shard(3, {});
  expect(await openForNewGames(chain, candidate(3))).toEqual(["0x2", "0x3"]);
  expect(opened).toEqual([2, 3]);
  expect(await openForNewGames(chain, candidate(3))).toEqual([]);
  expect(await chain.openReleaseOf(FRONTIER)).toBe(3);
});

test("a Blitz release between two Frontier releases is neither opened nor applied for Frontier", async () => {
  const { chain, applied, opened } = shard(3, { 1: 1 }, { blitz: [2] });
  expect(await advanceGames(chain, published(1, 3), candidate(3), ["game-1"])).toEqual([
    { gameId: 1, from: 1, to: 3, transactions: ["0x13"] },
  ]);
  expect(applied).toEqual([[1, 3]]);
  expect(await openForNewGames(chain, candidate(3))).toEqual(["0x3"]);
  expect(opened).toEqual([3]);
  expect(await chain.openReleaseOf(BLITZ)).toBe(0);
});

test("a Frontier release leaves every Blitz game on its own release", async () => {
  const { chain, applied, pins } = shard(3, { 1: 1, 2: 2 }, { blitz: [2], blitzGames: [2] });
  expect(await advanceGames(chain, published(1, 3), candidate(3), ["game-1", "game-2"])).toEqual([
    { gameId: 1, from: 1, to: 3, transactions: ["0x13"] },
  ]);
  expect(pins).toEqual({ 1: 3, 2: 2 });
  expect(applied).toEqual([[1, 3]]);
});

test("a game of another family keeps its release", async () => {
  const { chain, applied, pins } = shard(2, { 1: 1, 2: 1 });
  chain.game = async (gameId) => ({ settled: false, family: gameId === 1 ? 2n : 1n });
  expect(await advanceGames(chain, published(1, 2), candidate(2), ["game-1", "game-2"])).toEqual([
    { gameId: 2, from: 1, to: 2, transactions: ["0x22"] },
  ]);
  expect(pins).toEqual({ 1: 1, 2: 2 });
  expect(applied).toEqual([[2, 2]]);
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
    shard(2, { 1: 1 }, { registered: { logic: [LOGIC.season, LOGIC.troops, "0x456"], migration: "0x0" } }),
    candidate(2),
    "release_contents_differ",
  ],
  [
    "the same release number registered with another migration",
    shard(2, { 1: 1 }, { registered: { logic: Object.values(LOGIC), migration: "0x99" } }),
    candidate(2),
    "release_contents_differ",
  ],
  [
    "a registered release missing one of the commit's logic classes",
    shard(2, { 1: 1 }, { registered: { logic: [LOGIC.season, LOGIC.troops], migration: "0x0" } }),
    candidate(2),
    "release_contents_differ",
  ],
  [
    "a registered release with the commit's classes in other slots",
    shard(2, { 1: 1 }, { registered: { logic: [LOGIC.troops, LOGIC.season, LOGIC.movement], migration: "0x0" } }),
    candidate(2),
    "release_contents_differ",
  ],
])("%s: refused, nothing sent", async (_case, { chain, applied }, release, refusal) => {
  await expect(advanceGames(chain, published(1, 2, 3), release, ["game-1"])).rejects.toThrow(refusal);
  expect(applied).toEqual([]);
});

test.each([
  ["Herald still serves only release 1", { releases: releaseLine(SCHEMA, [1]) }],
  [
    "Herald maps the pin's release to another schema",
    {
      releases: {
        "1": { schema: "0".repeat(64), family: 1, previous: 0 },
        "2": { schema: SCHEMA, family: 1, previous: 1 },
      },
    },
  ],
  ["Herald maps every release, uniformly, to another schema", { releases: releaseLine("f".repeat(64), [1, 2]) }],
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
      openReleaseOf: async () => 1,
      latestReleaseOf: async () => 2,
      releaseRegistered: async (releaseId) => releaseId <= 2,
      openRelease: async () => "0x2",
      registeredRelease: async (releaseId) => ({
        logic: Object.values(LOGIC),
        migration: "0x0",
        family: 1,
        previous: releaseId - 1,
      }),
      gameId: async (name) => games[name] ?? 0,
      gameRelease: async (gameId) => pins.get(gameId)!,
      game: async () => ({ settled: false, family: 1n }),
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
    const run = await store.enqueue({ environment: "madara.frontier", gameName: "frontier-interrupted" });
    await store.startNext(Date.now());
    if (summaryWritten) await store.saveGame(created(run.name, 7));
    const restarted = new D1LaunchStore(database.db, testChain());
    expect((await restarted.find("madara.frontier", run.name))?.status).toBe("running");
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
    const blitz = await store.enqueue({ environment: "madara.blitz", gameName: "bltz-3" });
    const queued = await store.enqueue({ environment: "madara.frontier", gameName: "frontier-next" });
    const names = await store.gameNames("madara.frontier");
    expect(names).toEqual([queued.name]);
    const { chain, applied } = chainOf({ [blitz.name]: 3 });
    expect(await advanceGames(chain, published(1, 2), candidate(2), names)).toEqual([]);
    expect(applied).toEqual([]);
  });
});
