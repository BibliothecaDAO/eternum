import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("StructureManager store wiring", () => {
  it("imports the structure store instead of declaring it inline", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/from "\.\/structure-record-store"/);
    expect(source).not.toMatch(/class Structures \{/);
  });
});
