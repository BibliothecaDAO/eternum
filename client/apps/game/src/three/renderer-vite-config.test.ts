import { describe, expect, it } from "vitest";
import { resolveRendererViteAlias } from "./renderer-vite-config";

describe("resolveRendererViteAlias", () => {
  it("does not alias three in the legacy build lane", () => {
    expect(resolveRendererViteAlias("legacy-webgl")).toBeUndefined();
  });

  it("aliases three to the compat shim in experimental lanes", () => {
    expect(resolveRendererViteAlias("experimental-webgpu-auto")).toEqual({
      find: /^three$/,
      replacement: expect.stringMatching(/src\/three\/three-webgpu-compat\.ts$/),
    });
  });
});
