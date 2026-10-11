// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { hash } from "starknet";
import { followGameRelease } from "./game-release";
import { NativeFactStore } from "./native-fact-store";

const setup = () => {
  const store = new NativeFactStore();
  const write = (releaseId: number) =>
    store.applyFacts([
      {
        model: "GameRelease",
        key: hash.computePoseidonHashOnElements([1]),
        value: { game_id: 1, release_id: releaseId, preset_commitment: "0x789" },
      },
    ]);
  write(1);
  const failed = vi.fn();
  const gate = followGameRelease(
    store,
    {
      gameId: 1,
      shard: { url: "http://shard.test", releaseSchemas: { "1": "schema", "2": "schema" } },
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
  const write = (release_id: number) =>
    store.applyFacts([
      {
        model: "GameRelease",
        key: hash.computePoseidonHashOnElements([1]),
        value: { game_id: 1, release_id, preset_commitment: "0x789" },
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
          releaseSchemas: { "1": "schema", "2": "schema" },
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
    { gameId: 1, shard: { url: "http://shard.test", releaseSchemas: { "1": "schema" } }, schemaIdentity: "schema" },
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
