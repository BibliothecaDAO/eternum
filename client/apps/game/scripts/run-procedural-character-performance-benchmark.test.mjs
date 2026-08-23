// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildProceduralCharacterPerformanceUrl,
  evaluateProceduralCharacterPerformanceResult,
} from "./run-procedural-character-performance-benchmark.mjs";

const PASSING_PERFORMANCE = {
  headroomPass: true,
  observedFps: 60.2,
  onScreenPass: true,
  reasons: [],
  state: "complete",
  status: "pass",
};

const createSnapshot = (performance = PASSING_PERFORMANCE) => ({
  canvas: { cssHeight: 831, cssWidth: 1_110, height: 831, width: 1_110 },
  canvasPresent: true,
  horizontalOverflow: false,
  ready: true,
  routeMounted: true,
  stats: {
    actorCount: 100,
    animationUpdateLaneCount: 3,
    drawCalls: 736,
    performance,
    rendererMode: "webgl2-fallback",
    runningCount: 100,
    triangles: 1_800_000,
    visibleHexCount: 100,
  },
  walkingProfileActive: true,
  viewport: { height: 900, width: 1_440 },
});

describe("procedural character performance benchmark", () => {
  it("builds the renderer-specific debug URL", () => {
    expect(
      buildProceduralCharacterPerformanceUrl({
        baseUrl: "https://127.0.0.1:4174",
        rendererMode: "webgpu-force-webgl",
      }),
    ).toBe("https://127.0.0.1:4174/debug/procedural-character-benchmark?rendererMode=webgpu-force-webgl");
  });

  it("passes a measured 60 FPS sample", () => {
    expect(evaluateProceduralCharacterPerformanceResult({ browserErrors: [], snapshot: createSnapshot() })).toEqual({
      displayLimited: false,
      ok: true,
      onScreen60Verified: true,
      reasons: [],
    });
  });

  it("accepts measured headroom when the automation display is below 60Hz", () => {
    const performance = {
      ...PASSING_PERFORMANCE,
      observedFps: 50,
      onScreenPass: false,
      reasons: ["display refresh is 50Hz; CPU/GPU work fits the 60 FPS budget"],
      status: "display-limited",
    };
    expect(
      evaluateProceduralCharacterPerformanceResult({ browserErrors: [], snapshot: createSnapshot(performance) }),
    ).toMatchObject({ displayLimited: true, ok: true, onScreen60Verified: false });
  });

  it("reports workload and renderer budget failures together", () => {
    const performance = {
      ...PASSING_PERFORMANCE,
      headroomPass: false,
      observedFps: 40,
      onScreenPass: false,
      reasons: ["CPU p95 is 20ms; budget is 16.67ms"],
      status: "fail",
    };
    const snapshot = createSnapshot(performance);
    snapshot.stats.drawCalls = 900;
    snapshot.stats.triangles = 2_100_000;
    const result = evaluateProceduralCharacterPerformanceResult({ browserErrors: ["runtime failure"], snapshot });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("walking draw calls were 900, budget is 800");
    expect(result.reasons).toContain("walking triangles were 2100000, budget is 2000000");
    expect(result.reasons).toContain("CPU p95 is 20ms; budget is 16.67ms");
  });
});
