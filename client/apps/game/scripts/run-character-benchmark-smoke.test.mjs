// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildCharacterBenchmarkSmokeUrl,
  evaluateCharacterBenchmarkSmokeResult,
  normalizeRequestedBenchmarkRendererMode,
} from "./run-character-benchmark-smoke.mjs";

const PASSING_STATS = {
  actorCount: 100,
  averageFrameMs: 18,
  drawCalls: 1_301,
  geometryCount: 18,
  hexCount: 100,
  p95FrameMs: 28,
  physicsBodyCount: 96,
  physicsConstraintCount: 80,
  physicsFailures: [],
  projectileActiveCount: 72,
  projectileDroppedCount: 0,
  projectileHitCount: 120,
  projectileStuckCount: 58,
  ragdollCount: 8,
  rendererMode: "webgpu",
  resetCount: 0,
  respawnCount: 8,
  runningCount: 92,
  simulationElapsedSeconds: 5,
  textureCount: 18,
  totalDeaths: 8,
  triangles: 6_300_000,
  visibleHexCount: 100,
  wasmHeapMiB: 128,
};

const snapshot = (stats = PASSING_STATS) => ({
  canvasPresent: true,
  horizontalOverflow: false,
  paused: false,
  ready: true,
  routeMounted: true,
  stats,
});

describe("character benchmark smoke contract", () => {
  it("builds the standalone benchmark URL and validates renderer modes", () => {
    expect(buildCharacterBenchmarkSmokeUrl({ baseUrl: "https://127.0.0.1:4173" })).toBe(
      "https://127.0.0.1:4173/debug/procedural-character-benchmark",
    );
    expect(
      buildCharacterBenchmarkSmokeUrl({
        baseUrl: "https://127.0.0.1:4173",
        rendererMode: "webgpu-force-webgl",
      }),
    ).toBe("https://127.0.0.1:4173/debug/procedural-character-benchmark?rendererMode=webgpu-force-webgl");
    expect(normalizeRequestedBenchmarkRendererMode("webgpu-auto")).toBe("webgpu-auto");
    expect(() => normalizeRequestedBenchmarkRendererMode("legacy-webgl")).toThrow("Unsupported renderer mode");
  });

  it("accepts a complete 100-character death and respawn cycle", () => {
    expect(
      evaluateCharacterBenchmarkSmokeResult({
        activeSnapshot: snapshot(),
        browserErrors: [],
        pausedSnapshot: { ...snapshot(), paused: true },
        readySnapshot: snapshot({ ...PASSING_STATS, ragdollCount: 0, runningCount: 100, totalDeaths: 0 }),
        reducedPopulationSnapshot: snapshot({ ...PASSING_STATS, actorCount: 25, ragdollCount: 0, runningCount: 25 }),
        resetSnapshot: snapshot({
          ...PASSING_STATS,
          ragdollCount: 0,
          resetCount: 5,
          runningCount: 100,
          totalDeaths: 0,
        }),
        respawnSnapshot: snapshot(),
        restoredPopulationSnapshot: snapshot(),
        steppedSnapshot: snapshot({ ...PASSING_STATS, simulationElapsedSeconds: 5.1 }),
      }),
    ).toEqual({ ok: true, reasons: [] });
  });

  it("reports missing population, map framing, physics, and lifecycle evidence together", () => {
    const broken = snapshot({
      ...PASSING_STATS,
      actorCount: 99,
      averageFrameMs: 0,
      drawCalls: 0,
      hexCount: 99,
      p95FrameMs: 1_200,
      physicsBodyCount: 0,
      physicsConstraintCount: 0,
      projectileActiveCount: 513,
      projectileDroppedCount: 2,
      projectileHitCount: 0,
      ragdollCount: 0,
      respawnCount: 0,
      runningCount: 98,
      totalDeaths: 0,
      triangles: 0,
      visibleHexCount: 98,
      wasmHeapMiB: 0,
    });
    const evaluation = evaluateCharacterBenchmarkSmokeResult({
      activeSnapshot: broken,
      browserErrors: ["runtime failure"],
      pausedSnapshot: { ...broken, paused: false },
      readySnapshot: { ...broken, canvasPresent: false, horizontalOverflow: true, ready: false },
      reducedPopulationSnapshot: broken,
      resetSnapshot: broken,
      respawnSnapshot: broken,
      restoredPopulationSnapshot: broken,
      steppedSnapshot: broken,
    });

    expect(evaluation.ok).toBe(false);
    expect(evaluation.reasons).toContain("actor count was 99, expected 100");
    expect(evaluation.reasons).toContain("visible hex count was 98, expected 100");
    expect(evaluation.reasons).toContain("kill burst produced no deaths");
    expect(evaluation.reasons).toContain("archer benchmark produced no projectile hits");
    expect(evaluation.reasons).toContain("projectile pool exceeded capacity (513/512)");
    expect(evaluation.reasons).toContain("projectile pool dropped 2 arrows");
    expect(evaluation.reasons).toContain("death cycle produced no respawn");
    expect(evaluation.reasons.at(-1)).toBe("browser reported 1 runtime error(s): runtime failure");
  });
});
