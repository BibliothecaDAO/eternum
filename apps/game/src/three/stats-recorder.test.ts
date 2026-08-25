import { describe, it, expect } from "vitest";
import { StatsRecorder, type StatsRecorderDeps } from "./stats-recorder";

function createMockDeps(overrides?: Partial<StatsRecorderDeps>): StatsRecorderDeps {
  return {
    getRendererInfo: () => ({
      reset: () => {},
      render: { calls: 42, triangles: 10000 },
      memory: { geometries: 5, textures: 3 },
      programs: [{ length: 2 }],
    }),
    getSceneName: () => "WorldMap",
    getMemoryStatsProvider: () => undefined,
    isGraphicsDevEnabled: false,
    ...overrides,
  };
}

describe("StatsRecorder", () => {
  it("stop returns empty array when not recording", () => {
    const recorder = new StatsRecorder(createMockDeps());
    expect(recorder.stop()).toEqual([]);
  });

  it("capture is a no-op when not recording", () => {
    const recorder = new StatsRecorder(createMockDeps());
    recorder.capture();
    // stop still returns empty since we never started
    const samples = recorder.stop();
    expect(samples).toEqual([]);
  });

  it("includes memory stats when provider is available", () => {
    const recorder = new StatsRecorder(
      createMockDeps({
        getMemoryStatsProvider: () => ({
          getCurrentStats: () => ({ heapUsedMB: 100, heapTotalMB: 200 }),
        }),
      }),
    );
    recorder.start();
    recorder.capture();
    const samples = recorder.stop();
    expect(samples).toHaveLength(1);
    expect(samples[0].heapUsedMB).toBe(100);
    expect(samples[0].heapTotalMB).toBe(200);
  });

  it("accumulates samples while recording", () => {
    const recorder = new StatsRecorder(createMockDeps());
    recorder.start();
    recorder.capture();
    recorder.capture();
    recorder.capture();
    const samples = recorder.stop();
    expect(samples).toHaveLength(3);
    expect(samples[0].drawCalls).toBe(42);
    expect(samples[0].triangles).toBe(10000);
    expect(samples[0].scene).toBe("WorldMap");
  });

  it("uses scene name from deps", () => {
    let sceneName = "WorldMap";
    const recorder = new StatsRecorder(
      createMockDeps({
        getSceneName: () => sceneName,
      }),
    );
    recorder.start();
    recorder.capture();
    sceneName = "Hexception";
    recorder.capture();
    const samples = recorder.stop();
    expect(samples[0].scene).toBe("WorldMap");
    expect(samples[1].scene).toBe("Hexception");
  });

  it("destroy stops recording", () => {
    const recorder = new StatsRecorder(createMockDeps());
    recorder.start();
    recorder.capture();
    recorder.destroy();
    expect(recorder.stop()).toEqual([]);
  });
});
