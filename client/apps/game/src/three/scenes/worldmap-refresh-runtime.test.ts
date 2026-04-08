import { describe, expect, it, vi } from "vitest";

import { runWorldmapRefreshRuntime } from "./worldmap-refresh-runtime";

describe("runWorldmapRefreshRuntime", () => {
  it("adds and removes the suppression area around refresh hydration and commit", async () => {
    const suppressed = new Set<string>();
    const events: string[] = [];

    const result = await runWorldmapRefreshRuntime({
      commitRefresh: vi.fn(async () => {
        events.push("commit");
        return "committed";
      }),
      hydrateChunk: vi.fn(async () => {
        events.push("hydrate");
        expect(suppressed.has("24,24:render")).toBe(true);
        return {
          presentationRuntime: {
            phaseDurations: {
              structureAssetPrewarmMs: 1,
              structureHydrationDrainMs: 2,
              terrainPreparedMs: 3,
              tileHydrationDrainMs: 4,
            },
          },
          preparedTerrain: { chunkKey: "24,24" },
          tileFetchSucceeded: true,
        };
      }),
      onPreparedTerrainReady: vi.fn(() => {
        events.push("ready");
      }),
      refreshAreaKey: "24,24:render",
      suppressedAreaKeys: suppressed,
    });

    expect(result).toBe("committed");
    expect(events).toEqual(["hydrate", "ready", "commit"]);
    expect(suppressed.size).toBe(0);
  });

  it("still clears suppression state when hydration throws", async () => {
    const suppressed = new Set<string>();

    await expect(
      runWorldmapRefreshRuntime({
        commitRefresh: vi.fn(async () => "skipped"),
        hydrateChunk: vi.fn(async () => {
          throw new Error("hydrate failed");
        }),
        onPreparedTerrainReady: vi.fn(),
        refreshAreaKey: "48,48:render",
        suppressedAreaKeys: suppressed,
      }),
    ).rejects.toThrow("hydrate failed");

    expect(suppressed.size).toBe(0);
  });

  it("skips the ready callback when tile fetch did not succeed", async () => {
    const onPreparedTerrainReady = vi.fn();

    const result = await runWorldmapRefreshRuntime({
      commitRefresh: vi.fn(async () => "skipped"),
      hydrateChunk: vi.fn(async () => ({
        presentationRuntime: {
          phaseDurations: {
            structureAssetPrewarmMs: 0,
            structureHydrationDrainMs: 0,
            terrainPreparedMs: 0,
            tileHydrationDrainMs: 0,
          },
        },
        preparedTerrain: { chunkKey: "72,72" },
        tileFetchSucceeded: false,
      })),
      onPreparedTerrainReady,
      refreshAreaKey: "72,72:render",
      suppressedAreaKeys: new Set<string>(),
    });

    expect(result).toBe("skipped");
    expect(onPreparedTerrainReady).not.toHaveBeenCalled();
  });
});
