// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSceneSmokeUrl,
  decodePaddedWorldName,
  GLOW_REPRO_SCENES,
  GLOW_REPRO_TARGETS,
  evaluateRendererParitySummary,
  evaluateSceneSmokeResult,
  isRetryableAgentBrowserFailure,
  normalizeRendererDiagnosticsSnapshot,
  normalizeSceneList,
  resolveAgentBrowserWorkingDirectory,
  resolveSceneSmokeWorldName,
} from "./run-renderer-scene-smoke.mjs";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("glow repro matrix", () => {
  it("locks the named scenes and targets used for glow regression review", () => {
    expect(GLOW_REPRO_SCENES).toEqual(["map", "travel"]);
    expect(GLOW_REPRO_TARGETS).toEqual([
      "Essence Rift / FragmentMine emissive structures",
      "Fast-travel accent surfaces",
      "World FX emissive icons",
    ]);
  });
});

describe("normalizeSceneList", () => {
  it("defaults to world and hex scenes when no explicit scene list is provided", () => {
    expect(normalizeSceneList("")).toEqual(["map", "hex"]);
  });

  it("parses comma-separated scenes and preserves the declared order", () => {
    expect(normalizeSceneList("map,travel,hex")).toEqual(["map", "travel", "hex"]);
  });
});

describe("buildSceneSmokeUrl", () => {
  it("builds the worldmap spectate url on the default appchain chain with renderer mode overrides", () => {
    expect(
      buildSceneSmokeUrl({
        baseUrl: "https://127.0.0.1:4173",
        rendererMode: "webgpu-auto",
        scene: "map",
        worldName: "blitzplay1",
      }),
    ).toBe("https://127.0.0.1:4173/play/appchain/blitzplay1/map?col=0&row=0&spectate=true&rendererMode=webgpu-auto");
  });

  it("requires a world name instead of guessing a stale default", () => {
    expect(() =>
      buildSceneSmokeUrl({
        baseUrl: "https://127.0.0.1:4173",
        rendererMode: "webgpu-auto",
        scene: "map",
      }),
    ).toThrow(/worldName/);
  });

  it("builds the hexception url as a canonical spectator route", () => {
    expect(
      buildSceneSmokeUrl({
        chain: "madara",
        baseUrl: "https://127.0.0.1:4173",
        rendererMode: "webgpu-force-webgl",
        scene: "hex",
        worldName: "etrn-dawn",
      }),
    ).toBe(
      "https://127.0.0.1:4173/play/madara/etrn-dawn/hex?col=0&row=0&spectate=true&rendererMode=webgpu-force-webgl",
    );
  });
});

describe("decodePaddedWorldName", () => {
  it("decodes padded felt world names from GameRegistry", () => {
    expect(decodePaddedWorldName("0x0000000000000000000000000000000000000000626c747a2d737061726b2d373032")).toBe(
      "bltz-spark-702",
    );
  });
});

describe("resolveSceneSmokeWorldName", () => {
  it("honors an explicit world override without querying discovery backends", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      resolveSceneSmokeWorldName({
        chain: "appchain",
        requestedWorldName: "bltz-manual-101",
      }),
    ).resolves.toBe("bltz-manual-101");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses the newest indexed Madara game without probing per-world hosts", async () => {
    vi.stubEnv("HERALD_URL", "https://herald.example.test");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          games: [
            { game_id: 702, name: "bltz-spark-702" },
            { game_id: 701, name: "bltz-older-701" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      resolveSceneSmokeWorldName({
        chain: "madara",
        requestedWorldName: "",
      }),
    ).resolves.toBe("bltz-spark-702");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("discovers the newest configured game from the appchain GameRegistry", async () => {
    vi.stubEnv("HERALD_URL", "https://herald.example.test");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ games: [{ game_id: 702, name: "bltz-spark-702" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      resolveSceneSmokeWorldName({
        chain: "appchain",
        requestedWorldName: "",
      }),
    ).resolves.toBe("bltz-spark-702");

    const discoveryUrl = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(discoveryUrl.host).toBe("herald.example.test");
    expect(discoveryUrl.pathname).toBe("/appchain/games");
  });

  it("fails loudly when Herald is not configured", async () => {
    vi.stubEnv("HERALD_URL", "");
    vi.stubEnv("VITE_PUBLIC_HERALD_URL", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      resolveSceneSmokeWorldName({
        chain: "appchain",
        requestedWorldName: "",
      }),
    ).rejects.toThrow(/HERALD_URL or VITE_PUBLIC_HERALD_URL/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails loudly instead of falling back to a stale world name when no game is indexed", async () => {
    vi.stubEnv("HERALD_URL", "https://herald.example.test");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ games: [] }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    await expect(
      resolveSceneSmokeWorldName({
        chain: "appchain",
        requestedWorldName: "",
      }),
    ).rejects.toThrow(/No indexed game found/);
  });
});

describe("resolveAgentBrowserWorkingDirectory", () => {
  it("runs npx outside the repository workspace to avoid npm duplicate workspace-name failures", () => {
    expect(resolveAgentBrowserWorkingDirectory({ RUNNER_TEMP: "/runner-temp", TMPDIR: "/tmp" })).toBe("/runner-temp");
    expect(resolveAgentBrowserWorkingDirectory({ TMPDIR: "/tmp" })).toBe("/tmp");
  });
});

describe("isRetryableAgentBrowserFailure", () => {
  it("retries transient CDP Runtime.evaluate timeouts for eval commands", () => {
    expect(
      isRetryableAgentBrowserFailure({
        commandArgs: ["eval", "Boolean(document.getElementById('main-canvas'))"],
        stderr: "Error: ✗ CDP command timed out: Runtime.evaluate",
        stdout: "",
      }),
    ).toBe(true);
  });

  it("retries transient CDP Runtime.evaluate timeouts for read-only get commands", () => {
    expect(
      isRetryableAgentBrowserFailure({
        commandArgs: ["get", "url"],
        stderr: "Error: ✗ CDP command timed out: Runtime.evaluate",
        stdout: "",
      }),
    ).toBe(true);
    expect(
      isRetryableAgentBrowserFailure({
        commandArgs: ["get", "count", "text=Unable to Start"],
        stderr: "Error: ✗ CDP command timed out: Runtime.evaluate",
        stdout: "",
      }),
    ).toBe(true);
  });

  it("retries transient agent-browser daemon read failures for read-only commands", () => {
    expect(
      isRetryableAgentBrowserFailure({
        commandArgs: ["eval", "JSON.stringify(window.__rendererDiagnostics ?? null)"],
        stderr:
          "Error: ✗ Failed to read: Resource temporarily unavailable (os error 11) (after 5 retries - daemon may be busy or unresponsive)",
        stdout: "",
      }),
    ).toBe(true);
    expect(
      isRetryableAgentBrowserFailure({
        commandArgs: ["get", "count", "text=Unable to Start"],
        stderr:
          "Error: ✗ Failed to read: Resource temporarily unavailable (os error 11) (after 5 retries - daemon may be busy or unresponsive)",
        stdout: "",
      }),
    ).toBe(true);
  });

  it("does not retry commands that can change browser state", () => {
    expect(
      isRetryableAgentBrowserFailure({
        commandArgs: ["open", "https://127.0.0.1:4173", "--ignore-https-errors"],
        stderr: "Error: ✗ CDP command timed out: Runtime.evaluate",
        stdout: "",
      }),
    ).toBe(false);
  });

  it("does not retry regular application failures", () => {
    expect(
      isRetryableAgentBrowserFailure({
        commandArgs: ["eval", "JSON.stringify(window.__rendererDiagnostics ?? null)"],
        stderr: "Error: page reported runtime errors",
        stdout: "",
      }),
    ).toBe(false);
  });
});

describe("evaluateSceneSmokeResult", () => {
  it("accepts a scene when the browser lands on the expected route and the canvas is present", () => {
    expect(
      evaluateSceneSmokeResult({
        canvasExists: true,
        errors: [],
        expectedPathname: "/play/map",
        openedUrl: "https://127.0.0.1:4173/play/map?col=0&row=0&spectate=true",
        unableToStartCount: 0,
      }),
    ).toEqual({
      ok: true,
      reasons: [],
    });
  });

  it("reports all failing assertions together", () => {
    expect(
      evaluateSceneSmokeResult({
        canvasExists: false,
        errors: ["Error creating WebGL context"],
        expectedPathname: "/play/hex",
        openedUrl: "https://127.0.0.1:4173/play/map?col=0&row=0",
        unableToStartCount: 1,
      }),
    ).toEqual({
      ok: false,
      reasons: [
        "landed on unexpected route",
        "main canvas was not present",
        '"Unable to Start" was visible',
        "browser reported runtime errors",
      ],
    });
  });
});

describe("normalizeRendererDiagnosticsSnapshot", () => {
  it("fills missing diagnostics fields with explicit null and empty defaults", () => {
    expect(normalizeRendererDiagnosticsSnapshot(null)).toEqual({
      activeMode: null,
      buildMode: null,
      capabilities: null,
      degradations: [],
      effectPlan: null,
      fallbackReason: null,
      fallbacks: 0,
      initErrors: 0,
      initTimeMs: null,
      postprocessPolicy: null,
      requestedMode: null,
      sceneName: null,
      startupTimings: {},
    });
  });
});

describe("evaluateRendererParitySummary", () => {
  it("treats unsupported required features as blockers and optional fx as advisory", () => {
    expect(
      evaluateRendererParitySummary({
        activeMode: "webgpu",
        buildMode: "webgpu-auto",
        capabilities: {
          supportsBloom: false,
          supportsChromaticAberration: false,
          supportsColorGrade: false,
          supportsEnvironmentIbl: false,
          supportsToneMappingControl: true,
          supportsVignette: false,
          supportsWideLines: false,
        },
        degradations: [
          { feature: "environmentIbl", reason: "unsupported-backend" },
          { feature: "bloom", reason: "unsupported-backend" },
        ],
        effectPlan: null,
        fallbackReason: null,
        fallbacks: 0,
        initErrors: 0,
        initTimeMs: 18,
        postprocessPolicy: {
          bloomRouting: "mrt-emissive",
          mode: "native-webgpu-postprocess",
          prewarmStrategy: "compile-async",
          unsupportedFeatures: ["environmentIbl"],
        },
        requestedMode: "webgpu-auto",
        sceneName: "worldmap",
      }),
    ).toEqual({
      advisory: [],
      blocking: [
        { feature: "environmentIbl", reason: "unsupported-backend" },
        { feature: "bloom", reason: "unsupported-backend" },
      ],
      ok: false,
    });
  });
});
