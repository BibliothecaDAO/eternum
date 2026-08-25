import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("StructureManager reset pass", () => {
  it("updates draw counts only for models with entering or leaving slots", () => {
    const source = readSource("./structure-manager.ts");

    expect(source).toMatch(/private updateVisibleStructureModelCounts\(dirtyModels: Set<InstancedModel>\)/);
    expect(source).toMatch(/dirtyModels\.forEach\(\(model\) =>/);
    expect(source).not.toMatch(
      /this\.structureModels\.forEach\(\(models\) => \{\s*models\.forEach\(\(model\) => model\.setCount\(0\)\);\s*\}\);/,
    );
  });
});
