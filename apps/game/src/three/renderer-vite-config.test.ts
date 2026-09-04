import { describe, expect, it } from "vitest";
import { resolveRendererViteAlias } from "./renderer-vite-config";

describe("resolveRendererViteAlias", () => {
  it("always aliases three to the WebGPU compatibility entry", () => {
    expect(resolveRendererViteAlias()).toEqual({
      find: /^three$/,
      replacement: expect.stringMatching(/src\/three\/three-webgpu-compat\.ts$/),
    });
  });
});
