import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RENDERER_BUILD_MODE,
  removeRetiredRendererModePreference,
  resolveRendererBuildMode,
  resolveRendererBuildModeFromSearch,
} from "./renderer-build-mode";

describe("renderer build mode", () => {
  it("ships the WebGPU renderer with automatic WebGL2 fallback", () => {
    expect(resolveRendererBuildMode(undefined)).toBe(DEFAULT_RENDERER_BUILD_MODE);
    expect(DEFAULT_RENDERER_BUILD_MODE).toBe("webgpu-auto");
  });

  it("accepts retired deployment names as aliases", () => {
    expect(resolveRendererBuildMode(["experimental", "webgpu", "auto"].join("-"))).toBe("webgpu-auto");
    expect(resolveRendererBuildMode(["experimental", "webgpu", "force", "webgl"].join("-"))).toBe("webgpu-force-webgl");
  });

  it("uses a supported query override and ignores unknown values", () => {
    expect(
      resolveRendererBuildModeFromSearch({
        envBuildMode: "webgpu-auto",
        search: "?rendererMode=webgpu-force-webgl",
      }),
    ).toBe("webgpu-force-webgl");
    expect(resolveRendererBuildMode("bogus")).toBe("webgpu-auto");
  });

  it("removes the retired renderer preference", () => {
    const removeItem = vi.fn();
    removeRetiredRendererModePreference({ removeItem });
    expect(removeItem).toHaveBeenCalledWith("RENDERER_MODE");
  });
});
