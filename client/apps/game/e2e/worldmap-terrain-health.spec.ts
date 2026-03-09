import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import sharp from "sharp";

import type {
  WorldmapTerrainHealthState,
  WorldmapTerrainRecoveryDebugEvent,
} from "../src/three/scenes/worldmap-terrain-health";

const DEFAULT_STRESS_ITERATIONS = readOptionalNumber("WORLDMAP_TERRAIN_STRESS_ITERATIONS") ?? 24;
const DEFAULT_WORLD_NAME = process.env.WORLDMAP_SPECTATOR_WORLD ?? "s0-game-9";
const DEFAULT_WORLD_CHAIN = (process.env.WORLDMAP_SPECTATOR_CHAIN as "mainnet" | "sepolia" | "slot" | "slottest" | "local" | undefined) ?? "mainnet";
const DEFAULT_MOVE_REFRESH_MODE = process.env.WORLDMAP_MOVE_REFRESH_MODE === "force" ? "force" : "natural";
const ENABLE_SIMULATE_ALL_EXPLORED = process.env.WORLDMAP_SIMULATE_ALL_EXPLORED === "1";

interface BrowserTerrainHooks {
  setWorldmapPerfState?: (patch: {
    simulateAllExplored?: boolean;
    biomeAnimationsEnabled?: boolean;
    biomeShadowsEnabled?: boolean;
  }) => Promise<unknown>;
  getWorldmapTerrainHealthState?: () => WorldmapTerrainHealthState | null;
  getLastWorldmapTerrainRecoveryEvent?: () => WorldmapTerrainRecoveryDebugEvent | null;
  moveWorldmapToChunkOffset?: (options?: {
    colChunks?: number;
    rowChunks?: number;
    durationSeconds?: number;
    settleDelayMs?: number;
    refreshMode?: "force" | "natural";
  }) => Promise<unknown>;
  forceWorldmapChunkRefresh?: () => Promise<unknown>;
}

interface TerrainSample {
  label: string;
  health: WorldmapTerrainHealthState | null;
  lastRecoveryEvent: WorldmapTerrainRecoveryDebugEvent | null;
  screenshotPath?: string;
  visualMetrics?: WorldViewportVisualMetrics;
}

interface WorldViewportVisualMetrics {
  meanSaturation: number;
  stdLuminance: number;
  meanGradient: number;
}

function readOptionalNumber(name: string): number | null {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function seedActiveWorld(page: Page, worldName: string): Promise<void> {
  await page.addInitScript(
    ({ seededWorldName, seededWorldChain }) => {
      const profiles = {
        [seededWorldName]: {
          name: seededWorldName,
          chain: seededWorldChain,
          toriiBaseUrl: `https://api.cartridge.gg/x/${seededWorldName}/torii`,
          worldAddress: "0x0",
          contractsBySelector: {},
          fetchedAt: Date.now(),
        },
      };

      window.localStorage.setItem("ACTIVE_WORLD_NAME", seededWorldName);
      window.localStorage.setItem("ACTIVE_WORLD_CHAIN", seededWorldChain);
      window.localStorage.setItem("WORLD_PROFILES", JSON.stringify(profiles));
    },
    { seededWorldName: worldName, seededWorldChain: DEFAULT_WORLD_CHAIN },
  );
}

async function openSpectatorWorldmap(page: Page, worldName: string): Promise<void> {
  await seedActiveWorld(page, worldName);
  await page.goto(`/play/${encodeURIComponent(worldName)}/map?col=0&row=0&spectate=true`);
  await expect(page.locator("#main-canvas")).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const target = window as unknown as {
      getWorldmapPerfState?: () => { currentChunk?: string } | null;
    };
    const state = target.getWorldmapPerfState?.();
    return Boolean(state && state.currentChunk && state.currentChunk !== "null");
  });
  await page.waitForTimeout(1_500);
}

async function waitForTerrainHooks(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const target = window as unknown as BrowserTerrainHooks;
    return (
      typeof target.getWorldmapTerrainHealthState === "function" &&
      typeof target.getLastWorldmapTerrainRecoveryEvent === "function" &&
      typeof target.moveWorldmapToChunkOffset === "function" &&
      typeof target.forceWorldmapChunkRefresh === "function" &&
      typeof target.setWorldmapPerfState === "function"
    );
  });
}

async function sampleTerrain(page: Page, label: string): Promise<TerrainSample> {
  return await page.evaluate((sampleLabel) => {
    const target = window as unknown as BrowserTerrainHooks;
    return {
      label: sampleLabel,
      health: target.getWorldmapTerrainHealthState?.() ?? null,
      lastRecoveryEvent: target.getLastWorldmapTerrainRecoveryEvent?.() ?? null,
    };
  }, label);
}

async function attachStepScreenshot(testInfo: TestInfo, page: Page, label: string): Promise<string> {
  const screenshotDir = join(process.cwd(), "output", "playwright", "worldmap-terrain-health");
  await mkdir(screenshotDir, { recursive: true });
  const screenshotPath = join(screenshotDir, `${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  await testInfo.attach(`${label}.png`, {
    body: await readFile(screenshotPath),
    contentType: "image/png",
  });

  return screenshotPath;
}

async function analyzeWorldViewportScreenshot(screenshotPath: string): Promise<WorldViewportVisualMetrics> {
  const image = sharp(screenshotPath);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const crop = {
    left: 420,
    top: 60,
    width: Math.max(1, width - 440),
    height: Math.max(1, height - 120),
  };

  const { data, info } = await image.extract(crop).raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const pixelCount = info.width * info.height;

  const indexFor = (x: number, y: number) => (y * info.width + x) * channels;
  const luminanceAt = (index: number) => {
    const r = data[index] ?? 0;
    const g = data[index + 1] ?? 0;
    const b = data[index + 2] ?? 0;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  let saturationSum = 0;
  let luminanceSum = 0;
  let luminanceSquaredSum = 0;
  let gradientSum = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = indexFor(x, y);
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const maxChannel = Math.max(r, g, b);
      const minChannel = Math.min(r, g, b);
      const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
      const luminance = luminanceAt(index);

      saturationSum += saturation;
      luminanceSum += luminance;
      luminanceSquaredSum += luminance * luminance;

      if (x + 1 < info.width) {
        gradientSum += Math.abs(luminance - luminanceAt(indexFor(x + 1, y)));
      }
      if (y + 1 < info.height) {
        gradientSum += Math.abs(luminance - luminanceAt(indexFor(x, y + 1)));
      }
    }
  }

  const meanLuminance = luminanceSum / pixelCount;
  const stdLuminance = Math.sqrt(Math.max(0, luminanceSquaredSum / pixelCount - meanLuminance * meanLuminance));
  const meanGradient = gradientSum / (pixelCount * 2);

  return {
    meanSaturation: saturationSum / pixelCount,
    stdLuminance,
    meanGradient,
  };
}

async function moveByChunk(
  page: Page,
  move: { colChunks?: number; rowChunks?: number; refreshMode?: "force" | "natural" },
): Promise<void> {
  await page.evaluate(async (moveOptions) => {
    const target = window as unknown as BrowserTerrainHooks;
    await target.moveWorldmapToChunkOffset?.({
      ...moveOptions,
      durationSeconds: 0.25,
      settleDelayMs: 600,
    });
  }, move);
}

async function zoomPulse(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const canvas = document.getElementById("main-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    const dispatch = (deltaY: number) => {
      canvas.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY,
          bubbles: true,
          cancelable: true,
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2,
        }),
      );
    };

    dispatch(900);
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    dispatch(-900);
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  });
}

function isZeroTerrainFailure(sample: TerrainSample): boolean {
  const health = sample.health;
  if (!health) {
    return false;
  }

  return (
    health.currentChunk !== "null" &&
    health.hasCurrentChunkBounds &&
    health.currentChunkVisible !== false &&
    health.totalTerrainInstances === 0
  );
}

function getDominantBiomeShare(health: WorldmapTerrainHealthState | null): number {
  if (!health) {
    return 0;
  }

  const counts = Object.values(health.biomeInstanceCounts);
  if (counts.length === 0 || health.totalTerrainInstances <= 0) {
    return 0;
  }

  const maxCount = Math.max(...counts);
  return maxCount / health.totalTerrainInstances;
}

function getBiomeShare(health: WorldmapTerrainHealthState | null, biomeKey: string): number {
  if (!health || health.totalTerrainInstances <= 0) {
    return 0;
  }

  const count = health.biomeInstanceCounts[biomeKey] ?? 0;
  return count / health.totalTerrainInstances;
}

function isIgnorableWorldmapPageError(message: string): boolean {
  return (
    message.includes("src/ui/modules/settings/settings.tsx") &&
    message.includes("Cannot read properties of undefined") &&
    message.includes("reading 'filter'")
  );
}

test.describe("worldmap terrain health", () => {
  test("keeps terrain populated across chunk reversals and zoom pulses", async ({ page }, testInfo) => {
    test.slow();

    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];
    const samples: TerrainSample[] = [];
    const anomalies: Array<Record<string, unknown>> = [];
    let lastRecordedRecoveryAtMs = -1;

    page.on("console", (message) => {
      consoleMessages.push(`[${message.type()}] ${message.text()}`);
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.stack ?? error.message);
    });

    await openSpectatorWorldmap(page, DEFAULT_WORLD_NAME);

    if (consoleMessages.some((message) => message.includes("Error creating WebGL context"))) {
      test.skip(true, "Infra-blocked: browser environment could not create a WebGL context.");
    }

    await waitForTerrainHooks(page);

    await page.evaluate(async (simulateAllExplored) => {
      const target = window as unknown as BrowserTerrainHooks;
      await target.setWorldmapPerfState?.({
        simulateAllExplored,
        biomeAnimationsEnabled: true,
        biomeShadowsEnabled: true,
      });
    }, ENABLE_SIMULATE_ALL_EXPLORED);

    const initial = await sampleTerrain(page, "initial");
    initial.screenshotPath = await attachStepScreenshot(testInfo, page, "initial");
    initial.visualMetrics = await analyzeWorldViewportScreenshot(initial.screenshotPath);
    samples.push(initial);
    const initialNonZeroBiomeCount = initial.health?.nonZeroBiomeCount ?? 0;
    const initialDominantBiomeShare = getDominantBiomeShare(initial.health);
    const initialVisualMetrics = initial.visualMetrics;

    const moves = [
      { colChunks: 1, rowChunks: 0, refreshMode: DEFAULT_MOVE_REFRESH_MODE },
      { colChunks: 1, rowChunks: 0, refreshMode: DEFAULT_MOVE_REFRESH_MODE },
      { colChunks: -1, rowChunks: 0, refreshMode: DEFAULT_MOVE_REFRESH_MODE },
      { colChunks: -1, rowChunks: 0, refreshMode: DEFAULT_MOVE_REFRESH_MODE },
      { colChunks: 0, rowChunks: 1, refreshMode: DEFAULT_MOVE_REFRESH_MODE },
      { colChunks: 0, rowChunks: -1, refreshMode: DEFAULT_MOVE_REFRESH_MODE },
      { colChunks: 1, rowChunks: 0, refreshMode: "force" as const },
      { colChunks: -1, rowChunks: 0, refreshMode: "force" as const },
    ];

    for (let index = 0; index < DEFAULT_STRESS_ITERATIONS; index += 1) {
      const move = moves[index % moves.length]!;
      await moveByChunk(page, move);
      await zoomPulse(page);

      const sample = await sampleTerrain(page, `iteration-${index + 1}`);
      sample.screenshotPath = await attachStepScreenshot(testInfo, page, sample.label);
      sample.visualMetrics = await analyzeWorldViewportScreenshot(sample.screenshotPath);
      samples.push(sample);

      if (sample.lastRecoveryEvent && sample.lastRecoveryEvent.recordedAtMs > lastRecordedRecoveryAtMs) {
        lastRecordedRecoveryAtMs = sample.lastRecoveryEvent.recordedAtMs;
        anomalies.push({
          type: "recovery_event",
          label: sample.label,
          event: sample.lastRecoveryEvent,
          health: sample.health,
        });
      }

      if (isZeroTerrainFailure(sample)) {
        anomalies.push({
          type: "zero_terrain",
          label: sample.label,
          health: sample.health,
        });
        break;
      }

      if (sample.health && initialNonZeroBiomeCount >= 4) {
        const minimumExpectedBiomeCount = Math.max(2, Math.floor(initialNonZeroBiomeCount * 0.5));
        const dominantBiomeShare = getDominantBiomeShare(sample.health);
        const biomeDiversityCollapsed =
          sample.health.nonZeroBiomeCount < minimumExpectedBiomeCount &&
          dominantBiomeShare > initialDominantBiomeShare + 0.2;

        if (biomeDiversityCollapsed) {
          anomalies.push({
            type: "biome_diversity_collapse",
            label: sample.label,
            health: sample.health,
            baseline: {
              initialNonZeroBiomeCount,
              initialDominantBiomeShare,
            },
          });
          break;
        }
      }

      if (sample.visualMetrics && initialVisualMetrics) {
        const visualBiomeCollapse =
          sample.visualMetrics.stdLuminance < initialVisualMetrics.stdLuminance * 0.7 &&
          sample.visualMetrics.meanGradient < initialVisualMetrics.meanGradient * 0.45;
        const outlineShare = getBiomeShare(sample.health, "Outline");

        if (visualBiomeCollapse && outlineShare > 0.6) {
          anomalies.push({
            type: "visual_biome_collapse",
            label: sample.label,
            screenshotPath: sample.screenshotPath,
            visualMetrics: sample.visualMetrics,
            baselineVisualMetrics: initialVisualMetrics,
            outlineShare,
            health: sample.health,
          });
          break;
        }
      }
    }

    await testInfo.attach("worldmap-terrain-health.json", {
      body: Buffer.from(
        JSON.stringify(
          {
            iterations: DEFAULT_STRESS_ITERATIONS,
            anomalies,
            samples,
            consoleMessages,
            pageErrors,
          },
          null,
          2,
        ),
        "utf8",
      ),
      contentType: "application/json",
    });

    await testInfo.attach("worldmap-terrain-health.png", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    expect(pageErrors.filter((message) => !isIgnorableWorldmapPageError(message))).toEqual([]);
    expect(anomalies).toEqual([]);
  });
});
