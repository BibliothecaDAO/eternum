import { describe, expect, it } from "vitest";

import { resolveTerrainBenchmarkVariant, summarizeTerrainBenchmarkFrames } from "./terrain-benchmark-contract";
import { TerrainBenchmarkRecorder } from "./terrain-benchmark-recorder";

describe("terrain benchmark contract", () => {
  it("defines cumulative ablations ending at production rendering", () => {
    expect(resolveTerrainBenchmarkVariant("geometry")).toEqual({ props: false, shadows: false, texturedGround: false });
    expect(resolveTerrainBenchmarkVariant("material")).toEqual({ props: false, shadows: false, texturedGround: true });
    expect(resolveTerrainBenchmarkVariant("props")).toEqual({ props: true, shadows: false, texturedGround: true });
    expect(resolveTerrainBenchmarkVariant("production")).toEqual({ props: true, shadows: true, texturedGround: true });
  });

  it("reports frame percentiles, threshold counts, and one-percent-low fps", () => {
    const stats = summarizeTerrainBenchmarkFrames([8, 9, 10, 17, 34, 51]);

    expect(stats).toMatchObject({ above16Ms: 3, above33Ms: 2, above50Ms: 1, maxMs: 51, p50Ms: 10, p95Ms: 51 });
    expect(stats.fpsMedian).toBe(100);
    expect(stats.fpsOnePercentLow).toBeCloseTo(1_000 / 51);
  });

  it("correlates frame, window, coverage, lifecycle, and long-task evidence", () => {
    const recorder = new TerrainBenchmarkRecorder();
    recorder.setPhase("static");
    recorder.recordFrame(0);
    recorder.recordFrame(10);
    recorder.recordFrame(20);
    recorder.recordTerrainEvent({ kind: "requested", requestedAtMs: 0, revision: 1 });
    recorder.recordTerrainEvent({
      commitCpuMs: 3,
      completedAtMs: 10,
      completedPageKeys: ["focus"],
      coverage: { fog: true, geometry: true, props: "uploaded" },
      fingerprint: "focus-v1",
      kind: "page_complete",
      pageKey: "focus",
      requiredPageKeys: ["focus"],
      revision: 1,
      sourceReadyAtMs: 2,
      work: { queueWaitMs: 4, source: "built", workerBuildMs: 20 },
    });
    recorder.recordTerrainEvent({
      completedAtMs: 12,
      completedPageKeys: ["focus"],
      kind: "window_complete",
      requiredPageKeys: ["focus"],
      revision: 1,
      work: { builtPages: 1, queueWaitMs: 4, reusedPages: 0, sharedInFlightPages: 0, workerBuildMs: 20 },
    });
    recorder.recordRenderedFrame(14);
    recorder.recordCoverage(25, 0);
    recorder.recordLifecyclePageVisit();
    recorder.recordLongTask(52);

    expect(recorder.snapshot()).toMatchObject({
      chunks: {
        builtPages: 1,
        convergedWindows: 1,
        firstCompletePageP95Ms: 10,
        firstRenderedFrameP95Ms: 14,
        lifecyclePagesVisited: 1,
        requestedWindows: 1,
        windowConvergenceP95Ms: 12,
        workerBuildP95Ms: 20,
      },
      coverage: { checks: 1, missingFrames: 0, missingSamples: 0, samples: 25 },
      frames: { static: { p95Ms: 10, sampleCount: 2 } },
      longTasks: { count: 1, maxMs: 52 },
    });
  });
});
