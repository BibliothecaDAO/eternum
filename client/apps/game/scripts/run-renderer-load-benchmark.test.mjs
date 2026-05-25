// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildRendererLoadBenchmarkUrl,
  compareRendererLoadBenchmarkSummary,
  deriveRendererLoadRunMetrics,
  evaluateRendererLoadBenchmarkSummary,
  summarizeRendererLoadBenchmarkResults,
} from "./run-renderer-load-benchmark.mjs";

const assert = {
  equal: (actual, expected) => expect(actual).toBe(expected),
  deepEqual: (actual, expected) => expect(actual).toEqual(expected),
  match: (actual, pattern) => expect(actual).toMatch(pattern),
};

describe("buildRendererLoadBenchmarkUrl", () => {
  it("builds a spectator play route for the requested renderer mode", () => {
    assert.equal(
      buildRendererLoadBenchmarkUrl({
        baseUrl: "https://127.0.0.1:4173",
        chain: "slot",
        rendererMode: "experimental-webgpu-auto",
        scene: "map",
        worldName: "eternum-blitz-slot-4",
      }),
      "https://127.0.0.1:4173/play/slot/eternum-blitz-slot-4/map?col=0&row=0&spectate=true&rendererMode=experimental-webgpu-auto",
    );
  });
});

describe("deriveRendererLoadRunMetrics", () => {
  it("extracts entry, renderer, backend, and WebGPU timing metrics from browser snapshots", () => {
    const metrics = deriveRendererLoadRunMetrics({
      diagnostics: {
        activeMode: "webgpu",
        fallbackReason: null,
        startupTimings: {
          "experimental-backend-total": 1450,
          "webgpu-module-import": 320,
          "webgpu-renderer-init": 840,
        },
      },
      durations: {
        "renderer-init": 2500,
        "renderer-init-backend-await": 1600,
      },
      elapsedMs: 7200,
      milestones: [
        { elapsedMs: 1000, name: "renderer-init-started" },
        { elapsedMs: 3500, name: "renderer-init-completed" },
        { elapsedMs: 7200, name: "entry-ready" },
      ],
    });

    assert.deepEqual(metrics, {
      entryReadyMs: 7200,
      experimentalBackendTotalMs: 1450,
      fallbackMs: null,
      rendererBackendAwaitMs: 1600,
      rendererInitMs: 2500,
      rendererStalledAfterStartMs: 2500,
      webgpuModuleImportMs: 320,
      webgpuRendererInitMs: 840,
    });
  });
});

describe("summarizeRendererLoadBenchmarkResults", () => {
  it("computes p50, p95, max, and failure count per renderer mode", () => {
    const summary = summarizeRendererLoadBenchmarkResults([
      {
        ok: true,
        metrics: { entryReadyMs: 100, rendererInitMs: 10 },
        rendererMode: "legacy-webgl",
      },
      {
        ok: true,
        metrics: { entryReadyMs: 200, rendererInitMs: 20 },
        rendererMode: "legacy-webgl",
      },
      {
        ok: false,
        metrics: { entryReadyMs: 300, rendererInitMs: 30 },
        rendererMode: "legacy-webgl",
      },
    ]);

    assert.deepEqual(summary.metricsByMode["legacy-webgl"].entryReadyMs, {
      max: 300,
      p50: 200,
      p95: 300,
    });
    assert.equal(summary.metricsByMode["legacy-webgl"].failureCount, 1);
  });
});

describe("evaluateRendererLoadBenchmarkSummary", () => {
  it("fails when experimental startup remains stuck after renderer-init-started", () => {
    const evaluation = evaluateRendererLoadBenchmarkSummary({
      results: [
        {
          diagnostics: null,
          elapsedMs: 9200,
          metrics: {
            entryReadyMs: null,
            fallbackMs: null,
            rendererStalledAfterStartMs: 8200,
          },
          rendererMode: "experimental-webgpu-auto",
        },
      ],
    });

    assert.equal(evaluation.ok, false);
    assert.match(evaluation.failures.join("\n"), /stalled after renderer-init-started/);
    assert.match(evaluation.failures.join("\n"), /missing renderer diagnostics/);
  });

  it("fails when fallback happens without a fallback reason", () => {
    const evaluation = evaluateRendererLoadBenchmarkSummary({
      results: [
        {
          diagnostics: {
            activeMode: "legacy-webgl",
            fallbackReason: null,
            requestedMode: "experimental-webgpu-auto",
          },
          elapsedMs: 4000,
          metrics: {
            entryReadyMs: 3500,
            fallbackMs: 900,
            rendererStalledAfterStartMs: 900,
          },
          rendererMode: "experimental-webgpu-auto",
        },
      ],
    });

    assert.equal(evaluation.ok, false);
    assert.match(evaluation.failures.join("\n"), /fallback reason/);
  });
});

describe("compareRendererLoadBenchmarkSummary", () => {
  it("fails when p95 entry readiness regresses past the configured threshold", () => {
    const comparison = compareRendererLoadBenchmarkSummary(
      {
        metricsByMode: {
          "experimental-webgpu-auto": {
            entryReadyMs: { p95: 3000 },
            rendererInitMs: { p95: 1200 },
          },
        },
      },
      {
        metricsByMode: {
          "experimental-webgpu-auto": {
            entryReadyMs: { p95: 5000 },
            rendererInitMs: { p95: 1300 },
          },
        },
      },
    );

    assert.equal(comparison.ok, false);
    assert.match(comparison.failures.join("\n"), /entryReadyMs p95 regressed/);
  });
});
