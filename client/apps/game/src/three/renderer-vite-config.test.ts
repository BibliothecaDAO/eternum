import { describe, expect, it } from "vitest";
import { resolveRendererViteAlias } from "./renderer-vite-config";

describe("resolveRendererViteAlias", () => {
  it("does not alias three in the legacy build lane", () => {
    expect(resolveRendererViteAlias("legacy-webgl")).toBeUndefined();
  });

  it("aliases three to three/webgpu in experimental lanes", () => {
    expect(resolveRendererViteAlias("experimental-webgpu-auto")).toEqual({
      find: /^three$/,
      replacement: "three/webgpu",
    });
  });
});
