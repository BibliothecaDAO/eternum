import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("StructureManager reset pass", () => {
  it("resets only previously active instanced models instead of walking every model on each refresh", () => {
    const source = readSource("./structure-manager.ts");

    expect(source).toMatch(/previouslyActiveStructureModels/);
    expect(source).not.toMatch(
      /this\.structureModels\.forEach\(\(models\) => \{\s*models\.forEach\(\(model\) => model\.setCount\(0\)\);\s*\}\);/,
    );
  });
});
