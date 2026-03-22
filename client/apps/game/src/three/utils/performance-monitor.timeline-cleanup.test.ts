import { afterEach, describe, expect, it, vi } from "vitest";

import { PerformanceMonitor } from "./performance-monitor";

describe("PerformanceMonitor timeline cleanup", () => {
  afterEach(() => {
    PerformanceMonitor.reset();
    PerformanceMonitor.setEnabled(true);
    vi.restoreAllMocks();
  });

  it("clears Performance API measures immediately after recording them", () => {
    PerformanceMonitor.setEnabled(true);

    const clearMeasuresSpy = vi.spyOn(performance, "clearMeasures");

    PerformanceMonitor.begin("scene.update");
    PerformanceMonitor.end("scene.update");

    expect(clearMeasuresSpy).toHaveBeenCalledWith("perf_scene.update");
  });
});
