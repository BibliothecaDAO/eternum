import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("terrain benchmark lifecycle baseline", () => {
  it("measures and returns to the same origin window before comparing resources", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/three/debug/procedural-terrain-benchmark-renderer.ts"),
      "utf8",
    );
    const lifecycle = source.slice(
      source.indexOf("async function runLifecycleTrace"),
      source.indexOf("async function presentBenchmarkWindow"),
    );
    const firstOrigin = lifecycle.indexOf("presentBenchmarkWindow(runtime, INITIAL_FOCUS");
    const baseline = lifecycle.indexOf("const baseline = readRendererMemory");
    const secondOrigin = lifecycle.indexOf("presentBenchmarkWindow(runtime, INITIAL_FOCUS", firstOrigin + 1);
    const afterReturn = lifecycle.indexOf("const afterReturn = readRendererMemory");

    expect(firstOrigin).toBeGreaterThan(0);
    expect(firstOrigin).toBeLessThan(baseline);
    expect(secondOrigin).toBeGreaterThan(baseline);
    expect(secondOrigin).toBeLessThan(afterReturn);
  });
});
