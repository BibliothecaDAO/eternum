import { describe, expect, it } from "vitest";
import {
  DEFAULT_RENDERER_BUILD_MODE,
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

describe("resolveThreeEntryPoint", () => {
  it("uses the default three build for the legacy lane", () => {
    expect(resolveThreeEntryPoint("legacy-webgl")).toBe("three");
  });

  it("uses the three/webgpu build for experimental lanes", () => {
    expect(resolveThreeEntryPoint("experimental-webgpu-auto")).toBe("three/webgpu");
    expect(resolveThreeEntryPoint("experimental-webgpu-force-webgl")).toBe("three/webgpu");
  });
});
