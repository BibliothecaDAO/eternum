import { describe, expect, it } from "vitest";

import { createWorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";
import { evaluateTileFetchVolumeRegression } from "./worldmap-tile-fetch-volume-regression";

const diagnosticsWithFetchCount = (tileFetchStarted: number) => {
  const diagnostics = createWorldmapChunkDiagnostics();
  diagnostics.tileFetchStarted = tileFetchStarted;
  return diagnostics;
};

describe("evaluateTileFetchVolumeRegression", () => {
  it("passes when current fetch volume does not increase", () => {
    const baseline = diagnosticsWithFetchCount(20);
    const current = diagnosticsWithFetchCount(20);

    const result = evaluateTileFetchVolumeRegression({ baseline, current });

    expect(result.status).toBe("pass");
    expect(result.baselineFetchCount).toBe(20);
    expect(result.currentFetchCount).toBe(20);
    expect(result.increaseFraction).toBe(0);
  });

  it("fails when current fetch volume increases beyond allowed threshold", () => {
    const baseline = diagnosticsWithFetchCount(20);
    const current = diagnosticsWithFetchCount(21);

    const result = evaluateTileFetchVolumeRegression({
      baseline,
      current,
      allowedIncreaseFraction: 0,
    });

    expect(result.status).toBe("fail");
    expect(result.baselineFetchCount).toBe(20);
    expect(result.currentFetchCount).toBe(21);
    expect(result.increaseFraction).toBeCloseTo(0.05);
  });

  it("passes when increase is within configured allowance", () => {
    const baseline = diagnosticsWithFetchCount(100);
    const current = diagnosticsWithFetchCount(104);

    const result = evaluateTileFetchVolumeRegression({
      baseline,
      current,
      allowedIncreaseFraction: 0.05,
    });

    expect(result.status).toBe("pass");
    expect(result.increaseFraction).toBeCloseTo(0.04);
  });

  it("handles zero baseline without divide-by-zero", () => {
    const baseline = diagnosticsWithFetchCount(0);
    const current = diagnosticsWithFetchCount(1);

    const result = evaluateTileFetchVolumeRegression({ baseline, current });

    expect(result.status).toBe("fail");
    expect(result.increaseFraction).toBe(Number.POSITIVE_INFINITY);
  });
});
