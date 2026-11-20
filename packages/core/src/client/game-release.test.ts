// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { hash } from "starknet";
import { followGameRelease } from "./game-release";
import { NativeFactStore } from "./native-fact-store";
import { gameRegistryRow } from "../test-support/game-registry";
import { releaseLine } from "../test-support/releases";

vi.mock("../../../../deploy/release/native-release", async (original) => {
  const { NATIVE_RELEASES } = await original<typeof import("../../../../deploy/release/native-release")>();
  return { NATIVE_RELEASES: { frontier: { ...NATIVE_RELEASES.frontier, since: 1 } } };
});

const frontierGame = () => ({
  model: "GameRegistry",
  key: hash.computePoseidonHashOnElements([1]),
  value: gameRegistryRow(),
});

const setup = () => {
  const store = new NativeFactStore();
  store.applyFacts([frontierGame()]);
  const write = (releaseId: number, createdReleaseId = 1) =>
    store.applyFacts([
      {
        model: "GameRelease",
        key: hash.computePoseidonHashOnElements([1]),
        value: { game_id: 1, release_id: releaseId, created_release_id: createdReleaseId },
      },
    ]);
  write(1);
  const failed = vi.fn();
  const gate = followGameRelease(
    store,
    {
      gameId: 1,
      shard: { url: "http://shard.test", releases: releaseLine("schema", [1, 2]) },
      schemaIdentity: "schema",
    },
    failed,
  );
  return { gate, write, failed };
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("holds every action until a changed pin's release is readable, then lets them all go", async () => {
  vi.useFakeTimers();
  const { gate, write, failed } = setup();
  await gate.ready();
  const fetched = vi.fn().mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", fetched);
  write(3);
  const sent = vi.fn();
  const waiting = [gate.ready().then(sent), gate.ready().then(sent)];
  await vi.advanceTimersByTimeAsync(0);
  expect(sent).not.toHaveBeenCalled();
  write(2);
  await vi.advanceTimersByTimeAsync(1_000);
  await Promise.all(waiting);
  expect(sent).toHaveBeenCalledTimes(2);
  expect(failed).not.toHaveBeenCalled();
  gate.dispose();
});

it("cancels a pending wait on disposal", async () => {
  vi.useFakeTimers();
  const { gate, write } = setup();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  write(3);
  const pending = expect(gate.ready()).rejects.toThrow("disposed");
  await vi.advanceTimersByTimeAsync(0);
  gate.dispose();
  await pending;
  expect(vi.getTimerCount()).toBe(0);
});

it("revalidates a pin after a failed manifest read was superseded by another pin", async () => {
  vi.useFakeTimers();
  const store = new NativeFactStore();
  store.applyFacts([frontierGame()]);
  const write = (release_id: number) =>
    store.applyFacts([
      {
        model: "GameRelease",
        key: hash.computePoseidonHashOnElements([1]),
        value: { game_id: 1, release_id, created_release_id: 1 },
      },
    ]);
  write(1);
  const fetched = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 1,
          chainId: "0x1",
          releases: releaseLine("schema", [1, 2]),
          rpcUrl: "http://rpc.test",
          l2GasBound: "0x47868c00",
          contracts: { games: "0x1" },
          accountClassHash: "0x2",
          guardianPublicKey: "0x3",
        }),
      ),
    );
  vi.stubGlobal("fetch", fetched);
  const failed = vi.fn();
  const gate = followGameRelease(
    store,
    { gameId: 1, shard: { url: "http://shard.test", releases: releaseLine("schema", [1]) }, schemaIdentity: "schema" },
    failed,
  );
  await gate.ready();
  write(2);
  await vi.advanceTimersByTimeAsync(0);
  write(1);
  await vi.advanceTimersByTimeAsync(1_000);
  await gate.ready();
  write(2);
  await gate.ready();
  expect(fetched).toHaveBeenCalledTimes(2);
  expect(failed).not.toHaveBeenCalled();
  gate.dispose();
});

for (const origin of [0, 3]) {
  it(`rechecks a changed creation pin and refuses its invalid release interval: ${origin}`, async () => {
    const { gate, write, failed } = setup();
    write(2);
    await gate.ready();
    write(2, origin);
    await expect(gate.ready()).rejects.toThrow(`release ${origin}..2`);
    expect(failed).toHaveBeenCalledOnce();
    gate.dispose();
  });
}

it("refreshes a missing historical release before allowing the game", async () => {
  const store = new NativeFactStore();
  store.applyFacts([
    frontierGame(),
    {
      model: "GameRelease",
      key: "0x1",
      value: { game_id: 1, release_id: 2, created_release_id: 1 },
    },
  ]);
  const fetched = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        version: 1,
        chainId: "0x1",
        releases: {
          "1": { schema: "old", family: 1, previous: 0 },
          "2": { schema: "schema", family: 1, previous: 1 },
        },
        rpcUrl: "http://rpc.test",
        l2GasBound: "0x47868c00",
        contracts: { games: "0x1" },
        accountClassHash: "0x2",
        guardianPublicKey: "0x3",
      }),
    ),
  );
  vi.stubGlobal("fetch", fetched);
  const failed = vi.fn();
  const gate = followGameRelease(
    store,
    {
      gameId: 1,
      shard: { url: "http://shard.test", releases: { "2": { schema: "schema", family: 1, previous: 1 } } },
      schemaIdentity: "schema",
    },
    failed,
  );
  await expect(gate.ready()).rejects.toThrow("release 1");
  expect(fetched).toHaveBeenCalledOnce();
  expect(failed).toHaveBeenCalledOnce();
  gate.dispose();
});
