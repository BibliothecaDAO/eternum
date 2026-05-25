// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clearGlobalsMock,
  debugWindow,
  isMemorySupportedMock,
  memoryMonitorInstances,
  registerGlobalsMock,
  statsRecorderInstances,
} = vi.hoisted(() => ({
  clearGlobalsMock: vi.fn(),
  debugWindow: {} as Record<string, unknown>,
  isMemorySupportedMock: vi.fn(() => true),
  memoryMonitorInstances: [] as MockMemoryMonitor[],
  registerGlobalsMock: vi.fn(),
  statsRecorderInstances: [] as MockStatsRecorder[],
}));

class MockStatsRecorder {
  public readonly capture = vi.fn();
  public readonly destroy = vi.fn();
  public readonly exportAsJSON = vi.fn();
  public readonly setupKeyboardShortcuts = vi.fn();
  public readonly start = vi.fn();
  public readonly stop = vi.fn(() => ["sample"]);

  constructor(public readonly deps: unknown) {
    statsRecorderInstances.push(this);
  }
}

class MockMemoryMonitor {
  public readonly getCurrentStats = vi.fn(() => ({
    geometries: 3,
    heapLimitMB: 100,
    heapTotalMB: 40,
    heapUsedMB: 20,
    materials: 2,
    memorySpike: false,
    spikeIncrease: 0,
    textures: 4,
  }));
  public readonly getSummary = vi.fn(() => ({
    averageMB: 22,
    largestSpikeMB: 0,
    spikeCount: 0,
    trendMBPerSecond: 0.5,
  }));
  public readonly setRenderer = vi.fn();

  constructor(public readonly options?: unknown) {
    memoryMonitorInstances.push(this);
  }

  static isMemoryAPISupported() {
    return isMemorySupportedMock();
  }
}

vi.mock("./stats-recorder", () => ({
  StatsRecorder: MockStatsRecorder,
}));

vi.mock("./utils/memory-monitor", () => ({
  MemoryMonitor: MockMemoryMonitor,
}));

vi.mock("./game-renderer-debug-globals", () => ({
  clearGameRendererDebugGlobals: clearGlobalsMock,
  registerGameRendererDebugGlobals: registerGlobalsMock,
}));

vi.mock("three/examples/jsm/libs/stats.module.js", () => ({
  default: class MockStats {
    public readonly dom = document.createElement("div");
    public readonly update = vi.fn();
  },
}));

vi.mock("./utils/material-pool", () => ({
  MaterialPool: {
    getInstance: () => ({
      getStats: () => ({
        totalReferences: 6,
        uniqueMaterials: 3,
      }),
    }),
  },
}));

const { createRendererMonitoringRuntime } = await import("./renderer-monitoring-runtime");

describe("renderer monitoring runtime", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    clearGlobalsMock.mockReset();
    registerGlobalsMock.mockReset();
    isMemorySupportedMock.mockReset();
    isMemorySupportedMock.mockReturnValue(true);
    memoryMonitorInstances.length = 0;
    statsRecorderInstances.length = 0;
  });

  it("sets up stats recorder and optional memory monitoring together", () => {
    const runtime = createRendererMonitoringRuntime({
      debugWindow,
      getSceneName: () => "map",
      isGraphicsDevEnabled: false,
      isMemoryMonitoringEnabled: true,
      renderer: {
        info: {
          memory: { geometries: 1, textures: 2 },
          render: { calls: 12, triangles: 3400 },
          reset: vi.fn(),
        },
      } as never,
      rendererOwner: { id: "game-renderer" },
    });

    runtime.initialize();

    expect(statsRecorderInstances).toHaveLength(1);
    expect(statsRecorderInstances[0]?.setupKeyboardShortcuts).toHaveBeenCalledTimes(1);
    expect(memoryMonitorInstances).toHaveLength(1);
    expect(memoryMonitorInstances[0]?.setRenderer).toHaveBeenCalledTimes(1);
    expect(registerGlobalsMock).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBeGreaterThan(0);
  });

  it("captures, starts, stops, and exports stats through the recorder", () => {
    const runtime = createRendererMonitoringRuntime({
      debugWindow,
      getSceneName: () => "travel",
      isGraphicsDevEnabled: false,
      isMemoryMonitoringEnabled: false,
      renderer: {
        info: {
          memory: { geometries: 1, textures: 2 },
          render: { calls: 12, triangles: 3400 },
          reset: vi.fn(),
        },
      } as never,
      rendererOwner: { id: "game-renderer" },
    });

    runtime.initialize();

    runtime.startStatsRecording();
    runtime.captureStatsSample();
    expect(runtime.stopStatsRecording()).toEqual(["sample"]);
    runtime.exportStatsRecording();

    expect(statsRecorderInstances[0]?.start).toHaveBeenCalledTimes(1);
    expect(statsRecorderInstances[0]?.capture).toHaveBeenCalledTimes(1);
    expect(statsRecorderInstances[0]?.stop).toHaveBeenCalledTimes(1);
    expect(statsRecorderInstances[0]?.exportAsJSON).toHaveBeenCalledTimes(1);
  });

  it("updates the memory display and schedules the next poll", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(() => 123 as never);
    const runtime = createRendererMonitoringRuntime({
      debugWindow,
      getSceneName: () => "hex",
      isGraphicsDevEnabled: false,
      isMemoryMonitoringEnabled: true,
      renderer: {
        info: {
          memory: { geometries: 1, textures: 2 },
          render: { calls: 12, triangles: 3400 },
          reset: vi.fn(),
        },
      } as never,
      rendererOwner: { id: "game-renderer" },
    });

    runtime.initialize();

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Memory Monitor");
  });

  it("cleans recorder, DOM, timeout, and debug globals during dispose", () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => {});
    const runtime = createRendererMonitoringRuntime({
      debugWindow,
      getSceneName: () => "map",
      isGraphicsDevEnabled: false,
      isMemoryMonitoringEnabled: true,
      renderer: {
        info: {
          memory: { geometries: 1, textures: 2 },
          render: { calls: 12, triangles: 3400 },
          reset: vi.fn(),
        },
      } as never,
      rendererOwner: { id: "game-renderer" },
    });

    runtime.initialize();
    runtime.dispose();
    runtime.dispose();

    expect(clearGlobalsMock).toHaveBeenCalledTimes(1);
    expect(statsRecorderInstances[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(document.body.textContent ?? "").not.toContain("Memory Monitor");
  });
});
