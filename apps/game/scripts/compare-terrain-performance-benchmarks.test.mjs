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
});

function summary(staticP95Ms, motionP95Ms, commitP95Ms, triangles) {
  return {
    results: [
      {
        rendererMode: "webgpu-auto",
        variant: "production",
        snapshot: {
          chunks: { commitP95Ms },
          frames: { motion: { p95Ms: motionP95Ms }, static: { p95Ms: staticP95Ms } },
          render: { drawCalls: 20, firstRenderMs: 80, propInstances: 5_000, triangles },
        },
      },
    ],
  };
}
