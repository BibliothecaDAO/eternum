import { afterEach, describe, expect, it } from "vitest";

import { PerformanceMonitor } from "./performance-monitor";

describe("PerformanceMonitor.sample", () => {
  afterEach(() => {
    PerformanceMonitor.reset();
  });

  it("records numeric samples in generated reports", () => {
    PerformanceMonitor.sample("sync.batch.total", 3);
    PerformanceMonitor.sample("sync.batch.total", 7);

    const report = PerformanceMonitor.generateReport();

    expect(report.metrics["sync.batch.total"]).toEqual({
      avg: 5,
      min: 3,
      max: 7,
      last: 7,
      p50: 3,
      p95: 7,
      sampleCount: 2,
    });
  });
});
