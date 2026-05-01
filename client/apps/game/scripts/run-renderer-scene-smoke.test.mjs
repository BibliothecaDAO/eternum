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
  it("builds the worldmap spectate url with renderer mode overrides", () => {
    expect(
      buildSceneSmokeUrl({
        baseUrl: "https://127.0.0.1:4173",
        rendererMode: "experimental-webgpu-auto",
        scene: "map",
      }),
    ).toBe(
      "https://127.0.0.1:4173/play/slot/eternum-blitz-slot-4/map?col=0&row=0&spectate=true&rendererMode=experimental-webgpu-auto",
    );
  });

  it("builds the hexception url as a canonical spectator route", () => {
    expect(
      buildSceneSmokeUrl({
        chain: "mainnet",
        baseUrl: "https://127.0.0.1:4173",
        rendererMode: "legacy-webgl",
        scene: "hex",
        worldName: "etrn-dawn",
      }),
    ).toBe("https://127.0.0.1:4173/play/mainnet/etrn-dawn/hex?col=0&row=0&spectate=true&rendererMode=legacy-webgl");
  });
});

describe("decodePaddedWorldName", () => {
  it("decodes padded felt world names from the factory indexer", () => {
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
        chain: "slot",
        requestedWorldName: "bltz-manual-101",
      }),
    ).resolves.toBe("bltz-manual-101");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("discovers the first alive factory world for the selected chain", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              name: "0x0000000000000000000000000000000000000000626c747a2d646561642d393939",
            },
            {
              name: "0x0000000000000000000000000000000000000000626c747a2d737061726b2d373032",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      resolveSceneSmokeWorldName({
        chain: "slot",
        requestedWorldName: "",
      }),
    ).resolves.toBe("bltz-spark-702");
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

  it("does not retry non-eval failures", () => {
    expect(
      isRetryableAgentBrowserFailure({
        commandArgs: ["get", "url"],
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
        buildMode: "experimental-webgpu-auto",
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
        requestedMode: "experimental-webgpu-auto",
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
