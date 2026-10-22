import { expect, test } from "vitest";
import { advanceGames, type ReleaseChain } from "./release";

const SCHEMA = "0x2fbdecd0";

/** A shard on `current`, its games pinned as `pins` (settled ones marked), recording every release it applies. */
function shard(current: number, pins: Record<number, number>, settled: number[] = []) {
  const applied: [number, number][] = [];
  const chain: ReleaseChain = {
    currentRelease: async () => current,
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
  expect(await advanceGames(chain, published(1, 2), [1], 2)).toEqual([
    { gameId: 1, from: 1, to: 2, transactions: ["0x12"] },
  ]);
  expect(applied).toEqual([[1, 2]]);
});

test("a rerun on games already at the release sends nothing", async () => {
  const { chain, applied } = shard(2, { 1: 2 });
  expect(await advanceGames(chain, published(1, 2), [1], 2)).toEqual([{ gameId: 1, from: 2, to: 2, transactions: [] }]);
  expect(applied).toEqual([]);
});

test("a game two releases behind advances one release at a time, in order", async () => {
  const { chain, applied } = shard(3, { 1: 1 });
  await advanceGames(chain, published(1, 2, 3), [1], 3);
  expect(applied).toEqual([
    [1, 2],
    [1, 3],
  ]);
});

test("a settled game keeps its pin", async () => {
  const { chain, applied } = shard(2, { 1: 1, 4: 1 }, [4]);
  expect((await advanceGames(chain, published(1, 2), [1, 4], 2)).map(({ gameId }) => gameId)).toEqual([1]);
  expect(applied).toEqual([[1, 2]]);
});

test("before the box half registers the release, nothing is sent", async () => {
  const { chain, applied } = shard(1, { 1: 1 });
  await expect(advanceGames(chain, published(1, 2), [1], 2)).rejects.toThrow("release_not_registered");
  expect(applied).toEqual([]);
});

test("an older commit never deploys over a newer registered release", async () => {
  const { chain, applied } = shard(3, { 1: 3 });
  await expect(advanceGames(chain, published(1, 2, 3), [1], 2)).rejects.toThrow("release_older_than_shard");
  expect(applied).toEqual([]);
});

test.each([
  ["Herald still serves only release 1", { releaseSchemas: { "1": SCHEMA } }],
  ["Herald maps the pin's release to another schema", { releaseSchemas: { "1": "0xother", "2": SCHEMA } }],
])("%s: nothing is sent", async (_case, herald) => {
  const { chain, applied } = shard(2, { 1: 1 });
  await expect(advanceGames(chain, herald, [1], 2)).rejects.toThrow("release_unpublished");
  expect(applied).toEqual([]);
});

test("a game pinned past the release is refused, and no other game moves", async () => {
  const { chain, applied } = shard(2, { 1: 1, 2: 3 });
  await expect(advanceGames(chain, published(1, 2, 3), [1, 2], 2)).rejects.toThrow("release_downgrade");
  expect(applied).toEqual([]);
});
