import { describe, expect, it } from "vitest";

import { summarizeNumericSamples } from "./performance-samples";

describe("summarizeNumericSamples", () => {
  it("returns zeroed metrics for empty samples", () => {
    expect(summarizeNumericSamples([], 12)).toEqual({
      avg: 0,
      min: 0,
      max: 0,
      last: 12,
      p50: 0,
      p95: 0,
      sampleCount: 0,
    });
  });

  it("computes nearest-rank percentiles for finite samples", () => {
    const summary = summarizeNumericSamples([10, 20, 30, 40, 50], 50);

    expect(summary).toEqual({
      avg: 30,
      min: 10,
      max: 50,
      last: 50,
      p50: 30,
      p95: 50,
      sampleCount: 5,
    });
  });

  it("ignores non-finite samples", () => {
    const summary = summarizeNumericSamples([10, Number.NaN, 20, Number.POSITIVE_INFINITY], 20);

    expect(summary).toEqual({
      avg: 15,
      min: 10,
      max: 20,
      last: 20,
      p50: 10,
      p95: 20,
      sampleCount: 2,
    });
  });
});
