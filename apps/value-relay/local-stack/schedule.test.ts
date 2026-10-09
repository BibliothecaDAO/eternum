import { afterEach, expect, it, vi } from "vitest";
import type { Miniflare } from "miniflare";
import { runScheduledWorkers } from "./schedule";
afterEach(() => vi.useRealTimers());
it("keeps checking the monitor when a relay tick hangs, without overlapping relay ticks", async () => {
  vi.useFakeTimers();
  const counts = new Map<string, number>();
  const runtime = {
    getWorker: async (name: string) => ({
      scheduled: async () => {
        counts.set(name, (counts.get(name) ?? 0) + 1);
        if (name === "relay") await new Promise(() => {});
      },
    }),
  } as unknown as Pick<Miniflare, "getWorker">;
  const shutdown = new AbortController();
  const running = runScheduledWorkers(runtime, shutdown.signal);
  await vi.advanceTimersByTimeAsync(0);
  expect(counts.get("monitor")).toBe(1);
  await vi.advanceTimersByTimeAsync(60000);
  expect(counts.get("monitor")).toBe(2);
  expect(counts.get("relay")).toBe(1);
  shutdown.abort();
  await running;
  expect(vi.getTimerCount()).toBe(0);
});
