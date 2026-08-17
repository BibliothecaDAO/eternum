import { describe, expect, it } from "vitest";

describe("three-webgpu-compat", () => {
  it("exposes the shared WebGPU API and isolated utility WebGL renderer", async () => {
    const compatModule = await import("./three-webgpu-compat");

    expect(compatModule.WebGLRenderer).toBeDefined();
    expect(compatModule.WebGPURenderer).toBeDefined();
  });
});
