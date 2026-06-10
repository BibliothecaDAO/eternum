// @vitest-environment node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  buildRendererDebugSmokeUrl,
  evaluateRendererDebugSmokeResult,
  normalizeDebugScenarios,
  parseAgentBrowserJson,
  resolveAgentBrowserWorkingDirectory,
} from "./run-renderer-debug-smoke.mjs";

describe("buildRendererDebugSmokeUrl", () => {
  it("builds the auth-free Three.js chunk debug route", () => {
    expect(buildRendererDebugSmokeUrl({ baseUrl: "https://127.0.0.1:4173" })).toBe(
      "https://127.0.0.1:4173/debug/three-chunks",
    );
  });
});

describe("normalizeDebugScenarios", () => {
  it("defaults to baseline and stress scenarios", () => {
    expect(normalizeDebugScenarios("")).toEqual(["baseline", "stress"]);
  });

  it("rejects scenarios the debug view does not expose", () => {
    expect(() => normalizeDebugScenarios("baseline,unknown")).toThrow('Unsupported debug scenario "unknown"');
  });
});

describe("evaluateRendererDebugSmokeResult", () => {
  it("accepts a mounted debug route with nonblank WebGL pixels and expected metrics", () => {
    expect(
      evaluateRendererDebugSmokeResult({
        bootShellPresent: false,
        errors: [],
        expectedMetrics: {
          chunkCount: "25",
          hotChunkCount: "1",
          tileCount: "6,400",
        },
        horizontalOverflow: false,
        metrics: {
          Chunks: "25",
          Hot: "1",
          Tiles: "6,400",
        },
        nonBlankCanvas: true,
        routeMounted: true,
        webglContextLost: false,
      }),
    ).toEqual({
      ok: true,
      reasons: [],
    });
  });

  it("reports every failed debug route assertion together", () => {
    expect(
      evaluateRendererDebugSmokeResult({
        bootShellPresent: true,
        errors: ["Error creating WebGL context"],
        expectedMetrics: {
          chunkCount: "81",
          hotChunkCount: "9",
          tileCount: "20,736",
        },
        horizontalOverflow: true,
        metrics: {
          Chunks: "25",
          Hot: "1",
          Tiles: "6,400",
        },
        nonBlankCanvas: false,
        routeMounted: false,
        webglContextLost: true,
      }),
    ).toEqual({
      ok: false,
      reasons: [
        "debug route was not mounted",
        "boot shell was still visible",
        "debug canvas was blank",
        "WebGL context was lost",
        "debug route had horizontal overflow",
        "browser reported 1 runtime error(s): Error creating WebGL context",
        "Chunks metric was 25, expected 81",
        "Tiles metric was 6,400, expected 20,736",
        "Hot metric was 1, expected 9",
      ],
    });
  });
});

describe("parseAgentBrowserJson", () => {
  it("accepts the JSON string wrapper returned by agent-browser eval", () => {
    expect(parseAgentBrowserJson('"{\\"hello\\":\\"world\\"}"')).toEqual({ hello: "world" });
  });

  it("also accepts direct JSON output", () => {
    expect(parseAgentBrowserJson('{"hello":"world"}')).toEqual({ hello: "world" });
  });
});

describe("main option validation", () => {
  it("rejects non-finite wait values before running browser commands", () => {
    const child = spawnSync("node", ["./scripts/run-renderer-debug-smoke.mjs", "--wait-ms", "not-a-number"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(child.status).toBe(1);
    expect(child.stderr).toContain('--wait-ms must be a finite number, received "not-a-number"');
  });
});

describe("debug route readiness", () => {
  it("waits for the debug route to mount before running scenario checks", () => {
    const source = readFileSync("./scripts/run-renderer-debug-smoke.mjs", "utf8");

    expect(source).toContain("waitForDebugRouteReady");
    expect(source).toContain("DEBUG_ROUTE_POLL_MS");
    expect(source).toContain("initialSnapshot");
  });
});

describe("resolveAgentBrowserWorkingDirectory", () => {
  it("runs npx outside the repository workspace to avoid npm duplicate workspace-name failures", () => {
    expect(resolveAgentBrowserWorkingDirectory({ RUNNER_TEMP: "/runner-temp", TMPDIR: "/tmp" })).toBe("/runner-temp");
    expect(resolveAgentBrowserWorkingDirectory({ TMPDIR: "/tmp" })).toBe("/tmp");
  });
});
