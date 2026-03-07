import { expect, test, type Page, type TestInfo } from "@playwright/test";

import type { WorldmapBenchmarkSnapshot } from "../src/three/scenes/worldmap-perf-debug-hooks";

const DEFAULT_DEBUG_ARMY_COUNT = readOptionalNumber("WORLDMAP_DEBUG_ARMY_COUNT") ?? 80;
const DEFAULT_SWEEP_ITERATIONS = readOptionalNumber("WORLDMAP_SWEEP_ITERATIONS") ?? 8;
const FRAME_P95_BUDGET_MS = readOptionalNumber("WORLDMAP_FRAME_P95_BUDGET_MS");
const SWITCH_P95_BUDGET_MS = readOptionalNumber("WORLDMAP_SWITCH_P95_BUDGET_MS");
const FRAME_P95_REGRESSION_FRACTION = readOptionalNumber("WORLDMAP_FRAME_P95_REGRESSION_FRACTION");
const SWITCH_P95_REGRESSION_FRACTION = readOptionalNumber("WORLDMAP_SWITCH_P95_REGRESSION_FRACTION");

interface ScenarioResult {
  label: string;
  snapshot: WorldmapBenchmarkSnapshot;
}

function readOptionalNumber(name: string): number | null {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getNearestRankPercentile(samples: number[], percentile: number): number | null {
  const finiteSamples = samples.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);

  if (finiteSamples.length === 0) {
    return null;
  }

  const rank = Math.max(1, Math.ceil(Math.max(0, Math.min(1, percentile)) * finiteSamples.length));
  return finiteSamples[rank - 1] ?? finiteSamples[finiteSamples.length - 1] ?? null;
}

function getRegressionFraction(baseline: number | null, current: number | null): number | null {
  if (baseline === null || current === null) {
    return null;
  }

  if (baseline <= 0) {
    return current <= 0 ? 0 : Number.POSITIVE_INFINITY;
  }

  return (current - baseline) / baseline;
}

async function openSpectatorWorldmap(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByText("Spectate").first().click();
  await page.waitForURL(/\/play\/map/);
  await expect(page.locator("#main-canvas")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2_500);
}

async function waitForBenchmarkHooks(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const target = window as unknown as Record<string, unknown>;
    return (
      typeof target.getWorldmapBenchmarkSnapshot === "function" &&
      typeof target.setWorldmapPerfState === "function" &&
      typeof target.moveWorldmapToChunkOffset === "function"
    );
  });
}

async function performChunkSweep(page: Page, iterations: number): Promise<void> {
  const moves = [
    { colChunks: 1, rowChunks: 0 },
    { colChunks: 0, rowChunks: 1 },
    { colChunks: -1, rowChunks: 0 },
    { colChunks: 0, rowChunks: -1 },
  ];

  for (let index = 0; index < iterations; index += 1) {
    const move = moves[index % moves.length]!;
    await page.evaluate(async (moveOptions) => {
      const target = window as unknown as {
        moveWorldmapToChunkOffset?: (options?: {
          colChunks?: number;
          rowChunks?: number;
          durationSeconds?: number;
          settleDelayMs?: number;
          refreshMode?: "force" | "natural";
        }) => Promise<unknown>;
      };

      await target.moveWorldmapToChunkOffset?.({
        ...moveOptions,
        durationSeconds: 0.3,
        settleDelayMs: 700,
        refreshMode: "natural",
      });
    }, move);
  }
}

async function runScenario(
  page: Page,
  label: string,
  debugArmyCount: number,
  sweepIterations: number,
): Promise<ScenarioResult> {
  await page.evaluate(
    async ({ debugArmyCount }) => {
      const target = window as unknown as {
        clearWorldmapDebugArmies?: () => unknown;
        setWorldmapPerfState?: (patch: {
          simulateAllExplored?: boolean;
          biomeAnimationsEnabled?: boolean;
          biomeShadowsEnabled?: boolean;
        }) => Promise<unknown>;
        spawnWorldmapDebugArmies?: (options?: {
          count?: number;
          spread?: number;
          troopType?: "Knight" | "Crossbowman" | "Paladin";
          troopTier?: "T1" | "T2" | "T3";
          mixTypes?: boolean;
          mixTiers?: boolean;
          isMine?: boolean;
        }) => Promise<unknown>;
      };

      target.clearWorldmapDebugArmies?.();
      await target.setWorldmapPerfState?.({
        simulateAllExplored: true,
        biomeAnimationsEnabled: true,
        biomeShadowsEnabled: true,
      });

      if (debugArmyCount > 0) {
        await target.spawnWorldmapDebugArmies?.({
          count: debugArmyCount,
          spread: 14,
          mixTypes: true,
          mixTiers: true,
          troopType: "Paladin",
          troopTier: "T1",
          isMine: false,
        });
      }
    },
    { debugArmyCount },
  );

  await page.waitForTimeout(1_500);
  await page.evaluate(() => {
    const target = window as unknown as {
      resetThreePerformanceReport?: () => void;
      resetWorldmapChunkDiagnostics?: () => void;
    };

    target.resetThreePerformanceReport?.();
    target.resetWorldmapChunkDiagnostics?.();
  });

  await page.waitForTimeout(1_000);
  await performChunkSweep(page, sweepIterations);
  await page.waitForTimeout(1_000);

  const snapshot = await page.evaluate(() => {
    const target = window as unknown as {
      getWorldmapBenchmarkSnapshot?: () => WorldmapBenchmarkSnapshot;
    };
    return target.getWorldmapBenchmarkSnapshot?.() ?? null;
  });

  expect(snapshot).not.toBeNull();

  return {
    label,
    snapshot: snapshot as WorldmapBenchmarkSnapshot,
  };
}

test.describe("worldmap performance benchmark", () => {
  test("captures terrain and army stress metrics", async ({ page }, testInfo) => {
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (message) => {
      consoleMessages.push(`[${message.type()}] ${message.text()}`);
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.stack ?? error.message);
    });

    await openSpectatorWorldmap(page);

    if (consoleMessages.some((message) => message.includes("Error creating WebGL context"))) {
      test.skip(true, "Infra-blocked: browser environment could not create a WebGL context.");
    }

    await waitForBenchmarkHooks(page);

    const terrainOnly = await runScenario(page, "terrain-only", 0, DEFAULT_SWEEP_ITERATIONS);
    const terrainAndUnits = await runScenario(page, "terrain-plus-units", DEFAULT_DEBUG_ARMY_COUNT, DEFAULT_SWEEP_ITERATIONS);

    const terrainOnlySwitchP95 = getNearestRankPercentile(
      terrainOnly.snapshot.diagnostics.diagnostics.switchDurationMsSamples,
      0.95,
    );
    const terrainAndUnitsSwitchP95 = getNearestRankPercentile(
      terrainAndUnits.snapshot.diagnostics.diagnostics.switchDurationMsSamples,
      0.95,
    );
    const frameRegressionFraction = getRegressionFraction(
      terrainOnly.snapshot.performance.frameTime.p95,
      terrainAndUnits.snapshot.performance.frameTime.p95,
    );
    const switchRegressionFraction = getRegressionFraction(terrainOnlySwitchP95, terrainAndUnitsSwitchP95);

    const comparison = {
      frameP95Ms: {
        terrainOnly: terrainOnly.snapshot.performance.frameTime.p95,
        terrainPlusUnits: terrainAndUnits.snapshot.performance.frameTime.p95,
        regressionFraction: frameRegressionFraction,
      },
      chunkSwitchP95Ms: {
        terrainOnly: terrainOnlySwitchP95,
        terrainPlusUnits: terrainAndUnitsSwitchP95,
        regressionFraction: switchRegressionFraction,
      },
    };

    await attachArtifacts(testInfo, page, {
      terrainOnly,
      terrainAndUnits,
      comparison,
      consoleMessages,
      pageErrors,
    });

    expect(terrainOnly.snapshot.state.simulateAllExplored).toBe(true);
    expect(terrainAndUnits.snapshot.state.debugArmies.debugArmyCount).toBeGreaterThanOrEqual(DEFAULT_DEBUG_ARMY_COUNT);
    expect(terrainOnly.snapshot.performance.frameTime.sampleCount).toBeGreaterThan(0);
    expect(terrainAndUnits.snapshot.performance.frameTime.sampleCount).toBeGreaterThan(0);
    expect(terrainAndUnits.snapshot.diagnostics.diagnostics.transitionStarted).toBeGreaterThanOrEqual(1);

    if (FRAME_P95_BUDGET_MS !== null) {
      expect(terrainAndUnits.snapshot.performance.frameTime.p95).toBeLessThanOrEqual(FRAME_P95_BUDGET_MS);
    }

    if (SWITCH_P95_BUDGET_MS !== null) {
      expect(terrainAndUnitsSwitchP95).not.toBeNull();
      expect(terrainAndUnitsSwitchP95 ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(SWITCH_P95_BUDGET_MS);
    }

    if (FRAME_P95_REGRESSION_FRACTION !== null) {
      expect(frameRegressionFraction).not.toBeNull();
      expect(frameRegressionFraction ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(FRAME_P95_REGRESSION_FRACTION);
    }

    if (SWITCH_P95_REGRESSION_FRACTION !== null) {
      expect(switchRegressionFraction).not.toBeNull();
      expect(switchRegressionFraction ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
        SWITCH_P95_REGRESSION_FRACTION,
      );
    }
  });
});

async function attachArtifacts(testInfo: TestInfo, page: Page, payload: Record<string, unknown>): Promise<void> {
  await testInfo.attach("worldmap-benchmark.json", {
    body: Buffer.from(JSON.stringify(payload, null, 2), "utf8"),
    contentType: "application/json",
  });

  await testInfo.attach("worldmap-benchmark.png", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}
