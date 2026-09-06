import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const runner = resolve("scripts/terrain-verification/run-worldmap-terrain-verification.mjs");

describe("worldmap terrain verification CLI", () => {
  it("persists an inconclusive verdict and failure artifacts when browser startup and screenshots fail", () => {
    const directory = mkdtempSync(join(tmpdir(), "worldmap-verification-failure-"));
    try {
      const executable = join(directory, "unavailable-browser");
      writeFileSync(executable, "#!/bin/sh\necho 'Browser unavailable in test' >&2\nexit 1\n", { mode: 0o755 });
      const artifacts = join(directory, "artifacts");

      const result = runCli(executable, artifacts, { timeoutMs: 1 });

      expect(result.status, result.stderr).toBe(2);
      const verdict = readJson(join(artifacts, "verdict.json"));
      expect(verdict).toMatchObject({
        status: "inconclusive",
        exitCode: 2,
        game: { expectedGameId: 21, worldName: "verification-fixture" },
        navigation: { status: "inconclusive" },
        fullAcceptance: { status: "inconclusive" },
      });
      expect(verdict.results[0].reasons.join(" ")).toContain("Browser unavailable in test");
      expect(verdict.results[0].reasons.join(" ")).toContain("screenshot unavailable");
      expect(verdict.commit).toBe(currentCommit());
      expect(verdict.notExercised).toContain("authoritative boundary exploration");

      const entry = readJson(join(artifacts, "entry.json"));
      expect(entry).toMatchObject({
        status: "inconclusive",
        evidence: {
          console: join(artifacts, "entry.console.log"),
          errors: join(artifacts, "entry.errors.log"),
          screenshot: { available: false, path: join(artifacts, "entry.png") },
        },
      });
      expect(existsSync(entry.evidence.console)).toBe(true);
      expect(existsSync(entry.evidence.errors)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("records targeted navigation, warm resource evidence, logs, screenshots, and partial full acceptance", () => {
    const directory = mkdtempSync(join(tmpdir(), "worldmap-verification-success-"));
    try {
      const executable = join(directory, "fake-browser.mjs");
      const statePath = join(directory, "browser-state.json");
      writeFileSync(executable, fakeBrowserScript(), { mode: 0o755 });
      writeFileSync(statePath, JSON.stringify({ col: 0, revision: 1, row: 0 }));
      const artifacts = join(directory, "artifacts");

      const result = runCli(executable, artifacts, { statePath, timeoutMs: 200 });

      expect(result.status, result.stderr).toBe(2);
      const verdict = readJson(join(artifacts, "verdict.json"));
      expect(verdict).toMatchObject({
        status: "inconclusive",
        navigation: { status: "pass", reasons: [] },
        fullAcceptance: { status: "inconclusive" },
      });
      expect(verdict.results).toHaveLength(11);
      expect(verdict.results.filter(({ name }) => name.startsWith("warm-revisit-"))).toHaveLength(3);
      expect(verdict.results.every(({ status }) => status === "pass")).toBe(true);

      const pan = readJson(join(artifacts, "pan-east.json"));
      expect(pan).toMatchObject({
        metadata: {
          actualBackend: "webgl2-fallback",
          commit: currentCommit(),
          fixtureIdentity: "live-authoritative-worldmap-v2",
          game: { gameId: 21, worldAddress: "0x123", worldName: "verification-fixture" },
          requestedCameraTarget: { col: 24, row: 0 },
          timingPolicy: "informational",
          traceIdentity: { sceneId: "worldmap-test" },
        },
        evidence: {
          screenshot: { available: true, path: join(artifacts, "pan-east.png") },
        },
      });
      expect(existsSync(pan.evidence.screenshot.path)).toBe(true);
      expect(existsSync(pan.evidence.console)).toBe(true);
      expect(existsSync(pan.evidence.errors)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function runCli(executable, artifacts, options) {
  return spawnSync(
    process.execPath,
    [
      runner,
      "--world",
      "verification-fixture",
      "--game-id",
      "21",
      "--artifact-dir",
      artifacts,
      "--timeout-ms",
      String(options.timeoutMs),
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_BROWSER_BIN: executable,
        FAKE_BROWSER_STATE: options.statePath ?? "",
      },
    },
  );
}

function currentCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fakeBrowserScript() {
  return `#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const commands = new Set(["open", "eval", "console", "errors", "screenshot", "reload", "close"]);
const commandIndex = args.findIndex((arg) => commands.has(arg));
const command = args[commandIndex];
const commandArgs = args.slice(commandIndex + 1);
const statePath = process.env.FAKE_BROWSER_STATE;
const readState = () => JSON.parse(readFileSync(statePath, "utf8"));
const writeState = (state) => writeFileSync(statePath, JSON.stringify(state));

if (command === "eval") {
  const expression = commandArgs.join(" ");
  const move = expression.match(/detail:\\s*\\{\\s*col:\\s*(-?\\d+),\\s*row:\\s*(-?\\d+)/);
  if (move) {
    const state = readState();
    writeState({ col: Number(move[1]), row: Number(move[2]), revision: state.revision + 1 });
    console.log("true");
  } else {
    const state = readState();
    console.log(JSON.stringify({
      cameraTargetHex: { col: state.col, row: state.row },
      canvasPresent: true,
      device: { userAgent: "fake-browser", platform: "test", hardwareConcurrency: 8, deviceMemoryGiB: 16 },
      gameIdentity: { pathname: "/play/madara/verification-fixture/map", gameId: 21, namespace: "s2", worldAddress: "0x123", worldName: "verification-fixture", tileRows: 40, structureRows: 3 },
      renderer: { activeMode: "webgl2-fallback" },
      resourceState: { preparedCachePages: 12, presentedPageSlots: 1, geometries: 10, textures: 5 },
      trace: [
        { event: "visual_window_resolved", details: { activePageKeys: ["-12,-12"] } },
        { event: "terrain_composite_rebuilt", details: { proceduralPreparedCachePages: 12 } }
      ],
      renderDiagnostics: {
        gauges: { worldBiomeSurfaceInstances: 40 },
        terrainPresentation: {
          contractVersion: 2,
          current: {
            completePageKeys: ["-12,-12"], converged: true,
            coverage: { geometry: true, props: "uploaded", fog: true },
            firstCompletePageAtMs: 3, requestedAtMs: 1, requestedPageKeys: ["-12,-12"],
            revision: state.revision, sceneId: "worldmap-test", sourceReadyAtMs: 2,
            windowCompleteAtMs: 4, windowFullyRenderedAtMs: 5,
            windowFullyRenderedBackend: "webgl2-fallback", windowFullyRenderedRevision: state.revision
          }
        }
      }
    }));
  }
} else if (command === "reload") {
  const state = readState();
  writeState({ col: 0, row: 0, revision: state.revision + 1 });
} else if (command === "console") {
  console.log("No console messages");
} else if (command === "errors") {
  console.log("No errors");
} else if (command === "screenshot") {
  const path = commandArgs[0];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "fake png");
}
`;
}
