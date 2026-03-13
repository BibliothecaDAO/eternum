import { describe, expect, it } from "vitest";

import { createWorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";
import { evaluateChunkSwitchP95Regression } from "./worldmap-chunk-latency-regression";

const diagnosticsWithSamples = (samples: number[]) => {
  const diagnostics = createWorldmapChunkDiagnostics();
  diagnostics.switchDurationMsSamples = [...samples];
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
});
