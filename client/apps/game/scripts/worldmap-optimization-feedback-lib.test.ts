// @vitest-environment node

import { createServer } from "node:net";
import { describe, expect, it } from "vitest";

import {
  compareWorldmapBenchmarkRuns,
  deriveWorldmapSpectatorDefaults,
  formatWorldmapOptimizationFeedback,
  resolveManagedWorldmapBaseUrl,
} from "./worldmap-optimization-feedback-lib.mjs";

function createMetricSummary(p95: number) {
  return {
    avg: p95,
    min: p95,
    max: p95,
    last: p95,
    p50: p95,
    p95,
    sampleCount: 5,
  };
}

function createBenchmarkPayload(options: {
  frameP95Ms: number;
  chunkSwitchSamples: number[];
  heapUsedMB?: number;
  metrics?: Record<string, number>;
}) {
  const metrics = Object.fromEntries(
    Object.entries(options.metrics ?? {}).map(([metricName, p95]) => [metricName, createMetricSummary(p95)]),
  );

  return {
    metadata: {
      capturedAt: "2026-03-10T00:00:00.000Z",
      debugArmyCount: 80,
      sweepIterations: 8,
    },
    terrainOnly: {
      label: "terrain-only",
      snapshot: {
        diagnostics: {
          diagnostics: {
            switchDurationMsSamples: [70, 72, 74, 76, 78],
          },
        },
        performance: {
          frameTime: createMetricSummary(14),
          memory: {
            matrixPool: {
              available: 10,
              inUse: 5,
              totalAllocated: 15,
              memoryMB: 12,
            },
            jsHeap: {
              usedMB: 110,
              totalMB: 140,
            },
          },
          metrics: {},
        },
        state: {
          simulateAllExplored: true,
          debugArmies: {
            debugArmyCount: 0,
          },
        },
      },
    },
    terrainAndUnits: {
      label: "terrain-plus-units",
      snapshot: {
        diagnostics: {
          diagnostics: {
            switchDurationMsSamples: options.chunkSwitchSamples,
          },
        },
        performance: {
          frameTime: createMetricSummary(options.frameP95Ms),
          memory: {
            matrixPool: {
              available: 20,
              inUse: 8,
              totalAllocated: 28,
              memoryMB: 18,
            },
            ...(options.heapUsedMB === undefined
              ? {}
              : {
                  jsHeap: {
                    usedMB: options.heapUsedMB,
                    totalMB: Math.max(200, options.heapUsedMB + 20),
                  },
                }),
          },
          metrics,
        },
        state: {
          simulateAllExplored: true,
          debugArmies: {
            debugArmyCount: 80,
          },
        },
      },
    },
    consoleMessages: [],
    pageErrors: [],
  };
}

describe("worldmap optimization feedback", () => {
  it("chooses the next open localhost port for the managed benchmark server", async () => {
    const occupiedServer = createServer();
    await new Promise((resolve, reject) => {
      occupiedServer.once("error", reject);
      occupiedServer.listen(0, "127.0.0.1", resolve);
    });
    const occupiedAddress = occupiedServer.address();
    expect(occupiedAddress).not.toBeNull();
    expect(typeof occupiedAddress).toBe("object");
    const occupiedPort = typeof occupiedAddress === "object" && occupiedAddress ? occupiedAddress.port : 0;

    try {
      const baseUrl = await resolveManagedWorldmapBaseUrl({
        preferredBaseUrl: `https://127.0.0.1:${occupiedPort}`,
        maxPortScan: 10,
      });

      expect(baseUrl).toMatch(/^https:\/\/127\.0\.0\.1:\d+$/);
      expect(new URL(baseUrl).port).not.toBe(String(occupiedPort));
    } finally {
      await new Promise((resolve, reject) => {
        occupiedServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });

  it("derives spectator world defaults from the local env configuration", () => {
    const defaults = deriveWorldmapSpectatorDefaults({
      envContents: `
        VITE_PUBLIC_CHAIN=slot
        VITE_PUBLIC_TORII=https://api.cartridge.gg/x/eternum-blitz-slot-3/torii
        VITE_PUBLIC_NODE_URL=https://api.cartridge.gg/x/eternum-blitz-slot-3/katana/rpc/v0_9
      `,
    });

    expect(defaults).toMatchObject({
      worldName: "eternum-blitz-slot-3",
      worldChain: "slot",
    });
  });

  it("flags frame and chunk-switch regressions against a saved baseline", () => {
    const baseline = createBenchmarkPayload({
      frameP95Ms: 24,
      chunkSwitchSamples: [100, 110, 115, 118, 120],
      heapUsedMB: 150,
      metrics: {
        armyUpdate: 8,
        chunkCommit: 12,
      },
    });
    const current = createBenchmarkPayload({
      frameP95Ms: 31,
      chunkSwitchSamples: [120, 130, 140, 150, 165],
      heapUsedMB: 156,
      metrics: {
        armyUpdate: 15,
        chunkCommit: 13,
      },
    });

    const result = compareWorldmapBenchmarkRuns({
      baseline,
      current,
      thresholds: {
        frameP95RegressionFraction: 0.2,
        chunkSwitchP95RegressionFraction: 0.15,
        jsHeapRegressionFraction: 0.1,
        metricP95RegressionFraction: 0.25,
        maxReportedMetricRegressions: 3,
      },
    });

    expect(result.status).toBe("regression");
    expect(result.checks.filter((check) => check.status === "regression")).toHaveLength(3);
    expect(result.checks.find((check) => check.key === "frame-p95-ms")).toMatchObject({
      status: "regression",
      currentValue: 31,
      baselineValue: 24,
    });
    expect(result.checks.find((check) => check.key === "chunk-switch-p95-ms")).toMatchObject({
      status: "regression",
      currentValue: 165,
      baselineValue: 120,
    });
    expect(result.topMetricRegressions[0]).toMatchObject({
      metricName: "armyUpdate",
      currentValue: 15,
      baselineValue: 8,
    });
  });

  it("reports missing baseline without manufacturing regressions", () => {
    const current = createBenchmarkPayload({
      frameP95Ms: 27,
      chunkSwitchSamples: [90, 95, 100, 105, 110],
      heapUsedMB: 145,
      metrics: {
        armyUpdate: 10,
      },
    });

    const result = compareWorldmapBenchmarkRuns({
      baseline: null,
      current,
    });

    expect(result.status).toBe("missing-baseline");
    expect(result.checks.every((check) => check.status === "missing-baseline")).toBe(true);
    expect(result.topMetricRegressions).toHaveLength(0);
  });

  it("formats a concise feedback report with the failing checks and hotspots", () => {
    const baseline = createBenchmarkPayload({
      frameP95Ms: 24,
      chunkSwitchSamples: [100, 110, 115, 118, 120],
      heapUsedMB: 150,
      metrics: {
        armyUpdate: 8,
      },
    });
    const current = createBenchmarkPayload({
      frameP95Ms: 31,
      chunkSwitchSamples: [120, 130, 140, 150, 165],
      heapUsedMB: 156,
      metrics: {
        armyUpdate: 15,
      },
    });

    const result = compareWorldmapBenchmarkRuns({
      baseline,
      current,
      thresholds: {
        frameP95RegressionFraction: 0.2,
        chunkSwitchP95RegressionFraction: 0.15,
        jsHeapRegressionFraction: 0.1,
        metricP95RegressionFraction: 0.25,
        maxReportedMetricRegressions: 3,
      },
    });

    const report = formatWorldmapOptimizationFeedback(result);

    expect(report).toContain("Worldmap Optimization Feedback");
    expect(report).toContain("Status: regression");
    expect(report).toContain("Frame p95");
    expect(report).toContain("Chunk switch p95");
    expect(report).toContain("armyUpdate");
  });
});
