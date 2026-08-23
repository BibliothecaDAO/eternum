// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  TERRAIN_BENCHMARK_RENDERERS,
  TERRAIN_BENCHMARK_VARIANTS,
  evaluateTerrainPerformanceResults,
} from "./terrain-verification/terrain-performance-evaluator.mjs";
import { buildTerrainPerformanceUrl } from "./terrain-verification/run-terrain-performance-benchmark.mjs";

describe("terrain performance benchmark", () => {
  it("builds a fixed auth-free benchmark URL", () => {
    expect(
      buildTerrainPerformanceUrl("https://localhost:4173/play/map", {
        rendererMode: "webgpu-force-webgl",
        runMode: "quick",
        variant: "production",
      }),
    ).toBe(
      "https://localhost:4173/debug/procedural-terrain-benchmark?capture=1&autorun=1&runMode=quick&variant=production&density=1.75&rendererMode=webgpu-force-webgl",
    );
  });

  it("uses a bounded structural trace when timings are informational", () => {
    expect(
      buildTerrainPerformanceUrl("http://localhost:4173", {
        rendererMode: "webgpu-force-webgl",
        runMode: "quick",
        timingPolicy: "informational",
        variant: "production",
      }),
    ).toContain("traceMode=structural");
  });

  it("passes a complete healthy ablation matrix", () => {
    const results = TERRAIN_BENCHMARK_RENDERERS.flatMap((renderer) =>
      TERRAIN_BENCHMARK_VARIANTS.map((variant) => passingResult(renderer, variant)),
    );

    expect(evaluateTerrainPerformanceResults(results, { runMode: "quick" })).toMatchObject({ ok: true, reasons: [] });
  });

  it("reports coverage, frame, commit, lifecycle, and resource failures", () => {
    const result = passingResult("webgpu-auto", "production");
    result.snapshot.coverage.missingFrames = 1;
    result.snapshot.frames.motion.p95Ms = 30;
    result.snapshot.chunks.commitP95Ms = 9;
    result.snapshot.chunks.lifecyclePagesVisited = 99;
    result.snapshot.lifecycle.geometryGrowth = 1;

    expect(
      evaluateTerrainPerformanceResults([result], {
        renderers: ["webgpu-auto"],
        runMode: "full",
        variants: ["production"],
      }),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        "webgpu-auto/production: terrain did not cover every sampled screen position",
        "webgpu-auto/production: motion frame p95 exceeded 25 ms",
        "webgpu-auto/production: page commit p95 exceeded 8 ms",
        "webgpu-auto/production: lifecycle did not visit 100 pages",
        "webgpu-auto/production: renderer resources grew after returning to origin",
      ]),
    });
  });

  it("accepts resource reclamation below the starting lifecycle plateau", () => {
    const result = passingResult("webgpu-auto", "production");
    result.snapshot.lifecycle.geometryGrowth = -1;

    expect(
      evaluateTerrainPerformanceResults([result], {
        renderers: ["webgpu-auto"],
        runMode: "full",
        variants: ["production"],
      }),
    ).toMatchObject({ ok: true, reasons: [] });
  });

  it("keeps structural gates while treating software-renderer timings as informational", () => {
    const result = passingResult("webgpu-force-webgl", "production");
    result.snapshot.chunks.commitP95Ms = 80;
    result.snapshot.frames.motion = frameStats({ p95Ms: 500, sampleCount: 5 });
    result.snapshot.frames.static = frameStats({ p95Ms: 500, sampleCount: 5 });
    result.snapshot.longTasks.maxMs = 500;
    result.snapshot.render.firstRenderMs = 2_000;

    expect(
      evaluateTerrainPerformanceResults([result], {
        renderers: ["webgpu-force-webgl"],
        runMode: "quick",
        timingPolicy: "informational",
        variants: ["production"],
      }),
    ).toMatchObject({ ok: true, reasons: [] });
    result.snapshot.coverage.missingSamples = 1;
    expect(
      evaluateTerrainPerformanceResults([result], {
        renderers: ["webgpu-force-webgl"],
        runMode: "quick",
        timingPolicy: "informational",
        variants: ["production"],
      }).reasons,
    ).toContain("webgpu-force-webgl/production: terrain did not cover every sampled screen position");
  });
});

function passingResult(rendererMode, variant) {
  const props = variant === "props" || variant === "production";
  const textured = variant !== "geometry";
  return {
    complete: true,
    errors: [],
    rendererMode,
    routeMounted: true,
    variant,
    snapshot: {
      activeMode: rendererMode === "webgpu-auto" ? "webgpu" : "webgl2-fallback",
      assets: { groundArrayRequests: textured ? 2 : 0, propCatalogRequests: props ? 1 : 0 },
      chunks: {
        builtPages: 30,
        commitMaxMs: 5,
        commitP95Ms: 4,
        committedWindows: 14,
        lifecyclePagesVisited: 100,
        prepareMaxMs: 100,
        prepareP95Ms: 80,
        requestedWindows: 14,
        reusedPages: 120,
        staleWindows: 0,
      },
      contractVersion: 1,
      densityMultiplier: 1.75,
      coverage: { checks: 17, missingFrames: 0, missingSamples: 0, samples: 425 },
      fixture: { cellCount: 82_944, fingerprint: "fullscreen-balanced-v2", pageCount: 144, visiblePageCount: 12 },
      frames: {
        motion: frameStats(),
        static: frameStats(),
      },
      lifecycle: { geometryGrowth: 0, textureGrowth: 0 },
      longTasks: { count: 0, maxMs: 0 },
      render: {
        drawCalls: props ? 28 : 12,
        firstRenderMs: 80,
        geometries: 20,
        pixelRatio: 1,
        propInstances: props ? 4_000 : 0,
        textures: textured ? 7 : 5,
        triangles: props ? 2_500_000 : 100_000,
      },
      runMode: "full",
      status: "complete",
      variant,
    },
  };
}

function frameStats(overrides = {}) {
  return {
    above16Ms: 0,
    above33Ms: 0,
    above50Ms: 0,
    fpsMedian: 120,
    fpsOnePercentLow: 100,
    maxMs: 12,
    p50Ms: 8.3,
    p95Ms: 9,
    p99Ms: 10,
    sampleCount: 240,
    ...overrides,
  };
}
