// @vitest-environment node
import { describe, expect, it } from "vitest";

import { compareTerrainPerformanceSummaries } from "./terrain-verification/compare-terrain-performance-benchmarks.mjs";

describe("terrain performance comparison", () => {
  it("reports measured improvements against a matching baseline", () => {
    const comparison = compareTerrainPerformanceSummaries(
      summary(30, 40, 12, 10_000_000),
      summary(10, 12, 4, 2_000_000),
    );

    expect(comparison).toMatchObject({ ok: true, reasons: [] });
    expect(comparison.comparisons[0].metrics).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "motionP95Ms", delta: -28 })]),
    );
  });

  it("fails only when a timing metric exceeds both relative and absolute thresholds", () => {
    const tinyRegression = compareTerrainPerformanceSummaries(
      summary(10, 10, 4, 2_000_000),
      summary(10.5, 10.5, 4.5, 2_050_000),
    );
    const materialRegression = compareTerrainPerformanceSummaries(
      summary(10, 10, 4, 2_000_000),
      summary(12, 12, 6, 2_500_000),
    );

    expect(tinyRegression.ok).toBe(true);
    expect(materialRegression).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["webgpu-auto/production: motionP95Ms regressed by 2.00"]),
    });
  });

  it("ignores candidate backends that are absent from an otherwise matching baseline", () => {
    const baseline = summary(10, 10, 4, 2_000_000);
    const candidate = summary(9, 9, 3, 1_500_000);
    candidate.results.push({ ...candidate.results[0], rendererMode: "webgpu-force-webgl" });

    expect(compareTerrainPerformanceSummaries(baseline, candidate)).toMatchObject({ ok: true, reasons: [] });
  });

  it("keeps contract mismatches and non-finite observations inconclusive", () => {
    const baseline = summary(10, 10, 4, 2_000_000);
    const candidate = summary(9, 9, 3, 1_500_000);
    candidate.results[0].snapshot.chunks.workerBuildP95Ms = Number.NaN;

    expect(compareTerrainPerformanceSummaries(baseline, candidate)).toMatchObject({
      ok: false,
      status: "inconclusive",
    });

    candidate.results[0].snapshot.chunks.workerBuildP95Ms = 4;
    candidate.results[0].snapshot.contractVersion = 1;
    expect(compareTerrainPerformanceSummaries(baseline, candidate)).toMatchObject({
      ok: false,
      status: "inconclusive",
    });
  });
});

function summary(staticP95Ms, motionP95Ms, commitP95Ms, triangles) {
  return {
    results: [
      {
        rendererMode: "webgpu-auto",
        variant: "production",
        snapshot: {
          contractVersion: 2,
          chunks: {
            commitP95Ms,
            commitSamples: 10,
            firstCompletePageP95Ms: 6,
            firstCompletePageSamples: 10,
            firstRenderedFrameP95Ms: 8,
            firstRenderedFrameSamples: 10,
            queueWaitP95Ms: 2,
            queueWaitSamples: 10,
            windowConvergenceP95Ms: 7,
            windowConvergenceSamples: 10,
            workerBuildP95Ms: 5,
            workerBuildSamples: 10,
          },
          frames: { motion: { p95Ms: motionP95Ms }, static: { p95Ms: staticP95Ms } },
          render: { drawCalls: 20, firstTerrainFrameMs: 80, propInstances: 5_000, triangles },
        },
      },
    ],
  };
}
