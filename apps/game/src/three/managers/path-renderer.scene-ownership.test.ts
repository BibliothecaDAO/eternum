import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("PathRenderer scene ownership", () => {
  it("removes singleton state from PathRenderer itself", () => {
    const source = readSource("path-renderer.ts");

    expect(source).not.toMatch(/private static instance/);
    expect(source).not.toMatch(/public static getInstance\(/);
    expect(source).not.toMatch(/PathRenderer\.instance/);
  });

  it("makes ArmyManager own its path renderer instance", () => {
    const source = readSource("army-manager.ts");

    expect(source).toMatch(/this\.pathRenderer = new PathRenderer\(/);
    expect(source).not.toMatch(/PathRenderer\.getInstance\(\)/);
  });
});
