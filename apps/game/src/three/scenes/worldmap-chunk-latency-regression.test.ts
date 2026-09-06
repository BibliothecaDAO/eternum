import { describe, expect, it } from "vitest";

import { createWorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";
import { evaluateChunkSwitchP95Regression } from "./worldmap-chunk-latency-regression";

const diagnosticsWithSamples = (samples: number[]) => {
  const diagnostics = createWorldmapChunkDiagnostics();
  diagnostics.switchDurationMsSamples = [...samples];
  return diagnostics;
};

const diagnosticsWithTerrainMilestoneSamples = (
  metric: "first_complete_page" | "window_convergence" | "first_rendered_frame",
  samples: number[],
) => {
  const diagnostics = createWorldmapChunkDiagnostics();
  if (metric === "first_complete_page") diagnostics.terrainFirstCompletePageDurationMsSamples = [...samples];
  if (metric === "window_convergence") diagnostics.terrainWindowConvergenceDurationMsSamples = [...samples];
  if (metric === "first_rendered_frame") diagnostics.terrainFirstRenderedFrameDurationMsSamples = [...samples];
  return diagnostics;
};

describe("evaluateChunkSwitchP95Regression", () => {
  it("passes when current p95 is within 10% of baseline", () => {
    const baseline = diagnosticsWithSamples([100, 100, 100, 100, 100, 100, 100, 100, 100, 200]);
    const current = diagnosticsWithSamples([100, 100, 100, 100, 100, 100, 100, 100, 100, 220]);

    const result = evaluateChunkSwitchP95Regression({
      baseline,
      current,
      allowedRegressionFraction: 0.1,
    });

    expect(result.status).toBe("pass");
    expect(result.baselineP95Ms).toBe(200);
    expect(result.currentP95Ms).toBe(220);
    expect(result.regressionFraction).toBeCloseTo(0.1);
  });

  it("fails when current p95 regresses by more than 10%", () => {
    const baseline = diagnosticsWithSamples([100, 100, 100, 100, 100, 100, 100, 100, 100, 200]);
    const current = diagnosticsWithSamples([100, 100, 100, 100, 100, 100, 100, 100, 100, 230]);

    const result = evaluateChunkSwitchP95Regression({
      baseline,
      current,
      allowedRegressionFraction: 0.1,
    });

    expect(result.status).toBe("fail");
    expect(result.baselineP95Ms).toBe(200);
    expect(result.currentP95Ms).toBe(230);
    expect(result.regressionFraction).toBeCloseTo(0.15);
  });

  it("returns pending when baseline or current have no samples", () => {
    const baseline = diagnosticsWithSamples([]);
    const current = diagnosticsWithSamples([120]);

    const result = evaluateChunkSwitchP95Regression({
      baseline,
      current,
      allowedRegressionFraction: 0.1,
    });

    expect(result.status).toBe("pending");
    if (result.status !== "pending") {
      throw new Error(`Expected pending status, got ${result.status}`);
    }
    expect(result.reason).toContain("Insufficient chunk-switch samples");
  });

  it("compares first-rendered-frame p95 independently from commit and convergence", () => {
    const baseline = diagnosticsWithTerrainMilestoneSamples(
      "first_rendered_frame",
      [50, 50, 50, 50, 50, 50, 50, 50, 50, 100],
    );
    baseline.switchDurationMsSamples = [100, 100, 100, 100, 100, 100, 100, 100, 100, 200];
    const current = diagnosticsWithTerrainMilestoneSamples(
      "first_rendered_frame",
      [50, 50, 50, 50, 50, 50, 50, 50, 50, 105],
    );
    current.switchDurationMsSamples = [100, 100, 100, 100, 100, 100, 100, 100, 100, 260];

    const result = evaluateChunkSwitchP95Regression({
      baseline,
      current,
      metric: "terrain_first_rendered_frame",
      allowedRegressionFraction: 0.1,
    });

    expect(result.status).toBe("pass");
    expect(result.metric).toBe("terrain_first_rendered_frame");
    expect(result.baselineP95Ms).toBe(100);
    expect(result.currentP95Ms).toBe(105);
    expect(result.regressionFraction).toBeCloseTo(0.05);
  });

  it("returns pending when first-rendered-frame samples are unavailable", () => {
    const baseline = diagnosticsWithSamples([100]);
    const current = diagnosticsWithSamples([110]);

    const result = evaluateChunkSwitchP95Regression({
      baseline,
      current,
      metric: "terrain_first_rendered_frame",
      allowedRegressionFraction: 0.1,
    });

    expect(result.status).toBe("pending");
    expect(result.metric).toBe("terrain_first_rendered_frame");
    if (result.status !== "pending") {
      throw new Error(`Expected pending status, got ${result.status}`);
    }
    expect(result.reason).toContain("terrain-first-rendered-frame");
  });

  it("returns pending for contract mismatches and insufficient finite samples", () => {
    const baseline = diagnosticsWithTerrainMilestoneSamples("window_convergence", [100, Number.NaN]);
    const current = diagnosticsWithTerrainMilestoneSamples("window_convergence", [105, Number.POSITIVE_INFINITY]);

    expect(
      evaluateChunkSwitchP95Regression({
        baseline,
        current,
        metric: "terrain_window_convergence",
        minimumSamples: 2,
      }),
    ).toMatchObject({ status: "pending", reason: expect.stringContaining("finite observations") });

    baseline.contractVersion = 1 as never;
    expect(evaluateChunkSwitchP95Regression({ baseline, current, metric: "terrain_window_convergence" })).toMatchObject(
      { status: "pending", reason: expect.stringContaining("contract mismatch") },
    );
  });
});
