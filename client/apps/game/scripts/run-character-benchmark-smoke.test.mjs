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
  maximumAnimatedMountBoneStretchRatio: 1,
  maximumLoadingMountHoofReach: 1.8,
  maximumRagdollMountBoneStretchRatio: 1,
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

  it("rejects renderer regressions beyond the measured 100-character budgets", () => {
    const overBudget = { ...PASSING_STATS, averageFrameMs: 66, drawCalls: 1_501, p95FrameMs: 81 };
    const evaluation = evaluateCharacterBenchmarkSmokeResult({
      activeSnapshot: snapshot(),
      browserErrors: [],
      pausedSnapshot: { ...snapshot(), paused: true },
      readySnapshot: snapshot({ ...overBudget, ragdollCount: 0, runningCount: 100, totalDeaths: 0 }),
      reducedPopulationSnapshot: snapshot({ ...PASSING_STATS, actorCount: 25, ragdollCount: 0, runningCount: 25 }),
      resetSnapshot: snapshot({ ...PASSING_STATS, ragdollCount: 0, resetCount: 5, runningCount: 100 }),
      respawnSnapshot: snapshot(),
      restoredPopulationSnapshot: snapshot(),
      steppedSnapshot: snapshot({ ...PASSING_STATS, simulationElapsedSeconds: 5.1 }),
    });

    expect(evaluation.reasons).toContain("ready draw calls were 1501, budget is 1500");
    expect(evaluation.reasons).toContain("average frame time was 66ms, budget is 65ms");
    expect(evaluation.reasons).toContain("p95 frame time was 81ms, budget is 80ms");
  });

  it("rejects stretched animated and ragdoll mount skeletons", () => {
    const stretched = {
      ...PASSING_STATS,
      maximumAnimatedMountBoneStretchRatio: 3.2,
      maximumRagdollMountBoneStretchRatio: 14.8,
    };
    const evaluation = evaluateCharacterBenchmarkSmokeResult({
      activeSnapshot: snapshot(stretched),
      browserErrors: [],
      pausedSnapshot: { ...snapshot(), paused: true },
      readySnapshot: snapshot({ ...PASSING_STATS, ragdollCount: 0, runningCount: 100, totalDeaths: 0 }),
      reducedPopulationSnapshot: snapshot({ ...PASSING_STATS, actorCount: 25, ragdollCount: 0, runningCount: 25 }),
      resetSnapshot: snapshot({ ...PASSING_STATS, ragdollCount: 0, resetCount: 5, runningCount: 100 }),
      respawnSnapshot: snapshot(),
      restoredPopulationSnapshot: snapshot(),
      steppedSnapshot: snapshot({ ...PASSING_STATS, simulationElapsedSeconds: 5.1 }),
    });

    expect(evaluation.reasons).toContain("active animated mount bone stretch was 3.2x; budget is 1.1x");
    expect(evaluation.reasons).toContain("active ragdoll mount bone stretch was 14.8x; budget is 1.5x");
  });

  it("rejects mount hoof targets that retain their staging anchors during load", () => {
    const evaluation = evaluateCharacterBenchmarkSmokeResult({
      activeSnapshot: snapshot(),
      browserErrors: [],
      pausedSnapshot: { ...snapshot(), paused: true },
      readySnapshot: snapshot({
        ...PASSING_STATS,
        maximumLoadingMountHoofReach: 42,
        ragdollCount: 0,
        runningCount: 100,
        totalDeaths: 0,
      }),
      reducedPopulationSnapshot: snapshot({ ...PASSING_STATS, actorCount: 25, ragdollCount: 0, runningCount: 25 }),
      resetSnapshot: snapshot({ ...PASSING_STATS, ragdollCount: 0, resetCount: 5, runningCount: 100 }),
      respawnSnapshot: snapshot(),
      restoredPopulationSnapshot: snapshot(),
      steppedSnapshot: snapshot({ ...PASSING_STATS, simulationElapsedSeconds: 5.1 }),
    });

    expect(evaluation.reasons).toContain("loading mount hoof reach was 42x character scale; budget is 3x");
  });
});
