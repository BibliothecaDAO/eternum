import { describe, expect, it } from "vitest";

import {
  buildSceneSmokeUrl,
  evaluateSceneSmokeResult,
  normalizeSceneList,
} from "./run-renderer-scene-smoke.mjs";

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
    ).toBe("https://127.0.0.1:4173/play/map?col=0&row=0&spectate=true&rendererMode=experimental-webgpu-auto");
  });

  it("builds the hexception url without spectate mode", () => {
    expect(
      buildSceneSmokeUrl({
        baseUrl: "https://127.0.0.1:4173",
        rendererMode: "legacy-webgl",
        scene: "hex",
      }),
    ).toBe("https://127.0.0.1:4173/play/hex?col=0&row=0&rendererMode=legacy-webgl");
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
        "\"Unable to Start\" was visible",
        "browser reported runtime errors",
      ],
    });
  });
});
