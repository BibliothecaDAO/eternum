import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MODEL_LOAD_WARNING_MS, warnIfModelLoadStalls } from "../utils/model-load-watch";
import { runWorldmapCriticalManagerCatchUp } from "./worldmap-critical-manager-catchup-runtime";

const CHUNK_TIMEOUT_MS = 12_000;
const context = { chunkKey: "24,24", transitionToken: 6, triggerReason: "test" };
const never = () => new Promise<void>(() => {});
const after = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("lets a model load take longer than the chunk timeout without reporting the manager stalled", async () => {
  const recover = vi.fn();
  const modelsLoaded = after(20_000);
  const failures = runWorldmapCriticalManagerCatchUp({
    context,
    managers: [
      { label: "structure", prewarm: () => modelsLoaded, run: () => modelsLoaded.then(() => after(100)), recover },
    ],
    timeoutMs: CHUNK_TIMEOUT_MS,
  });

  await vi.advanceTimersByTimeAsync(20_100);

  await expect(failures).resolves.toEqual([]);
  expect(recover).not.toHaveBeenCalled();
});

it("still reports a manager whose own pass stalls once its models are in", async () => {
  const recover = vi.fn();
  const failures = runWorldmapCriticalManagerCatchUp({
    context,
    managers: [{ label: "structure", prewarm: () => after(5_000), run: never, recover }],
    timeoutMs: CHUNK_TIMEOUT_MS,
  });

  await vi.advanceTimersByTimeAsync(5_000 + CHUNK_TIMEOUT_MS - 1);
  expect(recover).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);

  const reported = await failures;
  expect(reported.map(({ label }) => label)).toEqual(["structure"]);
  expect(String(reported[0].reason)).toContain(`timed out after ${CHUNK_TIMEOUT_MS}ms`);
  expect(recover).toHaveBeenCalledTimes(1);
});

it("warns once, by the model's name, about a model load that never settles", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  void warnIfModelLoadStalls(never(), "/models/frontier/beast-troll.glb");

  await vi.advanceTimersByTimeAsync(MODEL_LOAD_WARNING_MS - 1);
  expect(warn).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await vi.advanceTimersByTimeAsync(10 * MODEL_LOAD_WARNING_MS);

  expect(warn.mock.calls).toEqual([["[ModelLoad] /models/frontier/beast-troll.glb has not loaded after 60s"]]);
});

it("says nothing about a model load that settles in time, and hands its result through", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const loaded = warnIfModelLoadStalls(
    after(MODEL_LOAD_WARNING_MS - 1).then(() => "model"),
    "/models/realms/kingdom.glb",
  );

  await vi.advanceTimersByTimeAsync(10 * MODEL_LOAD_WARNING_MS);

  await expect(loaded).resolves.toBe("model");
  expect(warn).not.toHaveBeenCalled();
});
