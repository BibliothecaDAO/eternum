import { describe, expect, it } from "vitest";
import {
  DEFAULT_RENDERER_BUILD_MODE,
  RENDERER_MODE_STORAGE_KEY,
  resolveRendererBuildMode,
  resolveRendererBuildModeFromSearch,
  resolveThreeEntryPoint,
} from "./renderer-build-mode";

describe("renderer build mode", () => {
  it("defaults to the legacy webgl shipping lane", () => {
    expect(resolveRendererBuildMode(undefined)).toBe(DEFAULT_RENDERER_BUILD_MODE);
  });

  it("resolves the experimental webgpu auto lane", () => {
    expect(resolveRendererBuildMode("experimental-webgpu-auto")).toBe("experimental-webgpu-auto");
  });

  it("ignores unknown env values and falls back to legacy webgl", () => {
    expect(resolveRendererBuildMode("bogus")).toBe("legacy-webgl");
  });
});

describe("renderer build mode search overrides", () => {
  it("uses the env build mode when no renderer query override is present", () => {
    expect(
      resolveRendererBuildModeFromSearch({
        envBuildMode: "experimental-webgpu-auto",
        search: "",
      }),
    ).toBe("experimental-webgpu-auto");
  });

  it("allows experimental builds to be killed back to legacy webgl from the query param", () => {
    expect(
      resolveRendererBuildModeFromSearch({
        envBuildMode: "experimental-webgpu-auto",
        search: "?rendererMode=legacy-webgl",
      }),
    ).toBe("legacy-webgl");
  });

  it("allows experimental auto builds to be forced onto the webgl fallback lane", () => {
    expect(
      resolveRendererBuildModeFromSearch({
        envBuildMode: "experimental-webgpu-auto",
        search: "?rendererMode=experimental-webgpu-force-webgl",
      }),
    ).toBe("experimental-webgpu-force-webgl");
  });

  it("keeps legacy builds on the legacy lane even when the query asks for webgpu", () => {
    expect(
      resolveRendererBuildModeFromSearch({
        envBuildMode: "legacy-webgl",
        search: "?rendererMode=experimental-webgpu-auto",
      }),
    ).toBe("legacy-webgl");
  });
});

describe("localStorage user preference", () => {
  it("uses userPreference when no query param is present", () => {
    expect(
      resolveRendererBuildModeFromSearch({
        envBuildMode: "experimental-webgpu-auto",
        search: "",
        userPreference: "legacy-webgl",
      }),
    ).toBe("legacy-webgl");
  });

  it("query param takes priority over userPreference", () => {
    expect(
      resolveRendererBuildModeFromSearch({
        envBuildMode: "experimental-webgpu-auto",
        search: "?rendererMode=experimental-webgpu-force-webgl",
        userPreference: "legacy-webgl",
      }),
    ).toBe("experimental-webgpu-force-webgl");
  });

  it("ignores userPreference on legacy-webgl builds (cannot upgrade to webgpu)", () => {
    expect(
      resolveRendererBuildModeFromSearch({
        envBuildMode: "legacy-webgl",
        search: "",
        userPreference: "experimental-webgpu-auto",
      }),
    ).toBe("legacy-webgl");
  });

  it("ignores invalid userPreference values", () => {
    expect(
      resolveRendererBuildModeFromSearch({
        envBuildMode: "experimental-webgpu-auto",
        search: "",
        userPreference: "nonsense",
      }),
    ).toBe("experimental-webgpu-auto");
  });

  it("falls through to envBuildMode when userPreference is undefined", () => {
    expect(
      resolveRendererBuildModeFromSearch({
        envBuildMode: "experimental-webgpu-auto",
        search: "",
      }),
    ).toBe("experimental-webgpu-auto");
  });

  it("exports the storage key constant", () => {
    expect(RENDERER_MODE_STORAGE_KEY).toBe("RENDERER_MODE");
  });
});

describe("resolveThreeEntryPoint", () => {
  it("uses the default three build for the legacy lane", () => {
    expect(resolveThreeEntryPoint("legacy-webgl")).toBe("three");
  });

  it("uses the three/webgpu build for experimental lanes", () => {
    expect(resolveThreeEntryPoint("experimental-webgpu-auto")).toBe("three/webgpu");
    expect(resolveThreeEntryPoint("experimental-webgpu-force-webgl")).toBe("three/webgpu");
  });
});
