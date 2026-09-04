// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { MemoryMonitor } from "./memory-monitor";

const MB = 1024 * 1024;

describe("MemoryMonitor scoped attribution", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attributes only growth inside the named synchronous operation", () => {
    const memory = { usedJSHeapSize: 10 * MB };
    vi.stubGlobal("performance", { memory });
    const onMemorySpike = vi.fn();
    const monitor = new MemoryMonitor({ onMemorySpike });

    memory.usedJSHeapSize = 40 * MB;
    const measurement = monitor.beginScopedMeasurement("army-move", 5);
    memory.usedJSHeapSize = 44 * MB;

    expect(monitor.finishScopedMeasurement(measurement)).toBe(4);
    expect(onMemorySpike).not.toHaveBeenCalled();
  });

  it("reports growth above the scope's threshold with its own baseline", () => {
    const memory = { usedJSHeapSize: 20 * MB };
    vi.stubGlobal("performance", { memory });
    const onMemorySpike = vi.fn();
    const monitor = new MemoryMonitor({ onMemorySpike });
    const measurement = monitor.beginScopedMeasurement("army-move", 5);

    memory.usedJSHeapSize = 26 * MB;

    expect(monitor.finishScopedMeasurement(measurement)).toBe(6);
    expect(onMemorySpike).toHaveBeenCalledWith(expect.objectContaining({ context: "army-move", increaseMB: 6 }));
  });
});
