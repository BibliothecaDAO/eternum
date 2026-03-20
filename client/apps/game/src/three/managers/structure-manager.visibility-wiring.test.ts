import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("StructureManager visibility wiring", () => {
  it("passes the centralized visibility manager through to point icon renderers", () => {
    const source = readSource("./structure-manager.ts");

    expect(source).toMatch(/this\.frustumManager,\s*this\.visibilityManager,\s*\)/);
  });
});
