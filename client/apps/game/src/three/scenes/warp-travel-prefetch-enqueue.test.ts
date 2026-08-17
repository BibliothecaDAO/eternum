import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { enqueueWarpTravelPrefetch } from "./warp-travel-prefetch-enqueue";
import type { PrefetchQueueItem } from "./worldmap-prefetch-queue";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

describe("enqueueWarpTravelPrefetch", () => {
  it("skips empty chunk keys", () => {
    const queue: PrefetchQueueItem[] = [];
    const queuedAreaKeys = new Set<string>();

    const result = enqueueWarpTravelPrefetch({
      chunkKey: "",
      areaKey: "",
      priority: 2,
      queue,
      queuedAreaKeys,
    });

    expect(result).toEqual({ enqueued: false, skipped: true });
    expect(queue).toEqual([]);
    expect(Array.from(queuedAreaKeys)).toEqual([]);
  });

  it("skips chunks whose projection-sync area is already queued", () => {
    const queue: PrefetchQueueItem[] = [];
    const queuedAreaKeys = new Set<string>(["24,24:area"]);

    const result = enqueueWarpTravelPrefetch({
      chunkKey: "24,24",
      areaKey: "24,24:area",
      priority: 2,
      queue,
      queuedAreaKeys,
    });

    expect(result).toEqual({ enqueued: false, skipped: true });
    expect(queue).toEqual([]);
    expect(Array.from(queuedAreaKeys)).toEqual(["24,24:area"]);
  });

  it("enqueues new fetch areas and tracks their queued fetch key", () => {
    const queue: PrefetchQueueItem[] = [];
    const queuedAreaKeys = new Set<string>();

    const result = enqueueWarpTravelPrefetch({
      chunkKey: "24,24",
      areaKey: "24,24:area",
      priority: 2,
      queue,
      queuedAreaKeys,
    });

    expect(result).toEqual({ enqueued: true, skipped: false });
    expect(queue).toEqual([
      {
        chunkKey: "24,24",
        areaKey: "24,24:area",
        priority: 2,
        syncTiles: true,
      },
    ]);
    expect(Array.from(queuedAreaKeys)).toEqual(["24,24:area"]);
  });

  it("does not rebuild obsolete pending-fetch key sets at worldmap call sites", () => {
    const source = readWorldmapSource();

    expect(source).not.toMatch(/new Set\(this\.pendingChunks\.keys\(\)\)/);
  });
});
