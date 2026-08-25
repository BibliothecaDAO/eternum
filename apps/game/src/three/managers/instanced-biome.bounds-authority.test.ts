import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("InstancedBiome bounds authority", () => {
  it("short-circuits bounding recomputation when world bounds are authoritative", () => {
    const source = readSource("./instanced-biome.tsx");

    expect(source).toMatch(/if \(this\.worldBounds\) \{\s*this\.applyWorldBounds\(child\);\s*return;\s*\}/);
  });
});
