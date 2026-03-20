import { describe, expect, it } from "vitest";

describe("three-webgpu-compat", () => {
  it("re-exports the legacy shader helpers required by three-stdlib", async () => {
    const compatModule = await import("./three-webgpu-compat");

    expect(compatModule.UniformsUtils).toBeDefined();
    expect(compatModule.UniformsLib).toBeDefined();
    expect(compatModule.ShaderChunk).toBeDefined();
    expect(compatModule.ShaderLib).toBeDefined();
    expect(compatModule.WebGLRenderer).toBeDefined();
    expect(compatModule.WebGPURenderer).toBeDefined();
  });
});
