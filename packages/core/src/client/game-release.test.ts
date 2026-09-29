// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { hash } from "starknet";
import { followGameRelease, StaleGameReleaseUnchangedError } from "./game-release";
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

it("holds all concurrent signers throughout a stale-pin refresh and shares that refresh", async () => {
  const { gate, write } = setup();
  await gate.ready();
  const refresh = gate.refresh(1);
  expect(gate.refresh(1)).toBe(refresh);
  const signed = vi.fn();
  const waiting = [gate.ready().then(signed), gate.ready().then(signed)];
  await Promise.resolve();
  await Promise.resolve();
  expect(signed).not.toHaveBeenCalled();
  write(2);
  await refresh;
  await Promise.all(waiting);
  expect(signed).toHaveBeenCalledTimes(2);
  gate.dispose();
});

it("names an unchanged stale pin and releases the wait without poisoning future refreshes", async () => {
  vi.useFakeTimers();
  const { gate, write, failed } = setup();
  const refresh = expect(gate.refresh(1)).rejects.toBeInstanceOf(StaleGameReleaseUnchangedError);
  const blocked = expect(gate.ready()).rejects.toThrow("STALE_RELEASE_UNCHANGED");
  await vi.advanceTimersByTimeAsync(10_000);
  await Promise.all([refresh, blocked]);
  expect(failed).not.toHaveBeenCalled();
  write(2);
  await gate.refresh(1);
  await gate.ready();
  gate.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels the pending pin wait on disposal", async () => {
  vi.useFakeTimers();
  const { gate } = setup();
  const refresh = expect(gate.refresh(1)).rejects.toThrow("disposed");
  gate.dispose();
  await refresh;
  expect(vi.getTimerCount()).toBe(0);
});

it("revalidates a pin after a failed refresh was superseded by another pin", async () => {
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
          admissionUrl: "http://admission.test",
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
