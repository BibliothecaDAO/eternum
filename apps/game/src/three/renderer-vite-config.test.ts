import { describe, expect, it } from "vitest";
import { build } from "vite";
import { resolveRendererViteAliases } from "./renderer-vite-config";

describe("renderer module identity", () => {
  it("shares core classes and color management across WebGPU, legacy WebGL and direct source imports", async () => {
    const fixture = await loadRendererIdentityFixture();

    expect(fixture.appColor).toBe(fixture.gpuColor);
    expect(fixture.appColor).toBe(fixture.sourceColor);
    expect(fixture.appColorManagement).toBe(fixture.gpuColorManagement);
    expect(fixture.appColorManagement).toBe(fixture.sourceColorManagement);
    expect(fixture.uniform).toBe(fixture.TSL.uniform);
    expect(fixture.WebGPURenderer).toBeTypeOf("function");
    expect(fixture.WebGLRenderer).toBeTypeOf("function");
  }, 30_000);
});

async function loadRendererIdentityFixture() {
  const entry = "virtual:three-identity";
  const result = await build({
    configFile: false,
    logLevel: "silent",
    resolve: { alias: resolveRendererViteAliases(), dedupe: ["three"] },
    plugins: [
      {
        name: "three-identity-fixture",
        resolveId: (id) => (id === entry ? entry : null),
        load: (id) =>
          id === entry
            ? `
        export { Color as appColor, ColorManagement as appColorManagement, WebGLRenderer } from "three";
        export { Color as gpuColor, ColorManagement as gpuColorManagement, WebGPURenderer, TSL } from "three/webgpu";
        export { Color as sourceColor } from "three/src/math/Color.js";
        export { ColorManagement as sourceColorManagement } from "three/src/math/ColorManagement.js";
        export { uniform } from "three/tsl";
      `
            : null,
      },
    ],
    build: {
      write: false,
      minify: false,
      target: "esnext",
      rollupOptions: { input: entry, preserveEntrySignatures: "strict", output: { format: "es" } },
    },
  });
  if (Array.isArray(result) || !("output" in result)) throw new Error("Expected a single renderer bundle");
  const chunk = result.output.find((output) => output.type === "chunk" && output.isEntry);
  if (!chunk || chunk.type !== "chunk") throw new Error("Renderer fixture entry was not emitted");
  return import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`);
}
