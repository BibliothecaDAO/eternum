import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testFilePath = fileURLToPath(import.meta.url);
const gameAppRoot = resolve(dirname(testFilePath), "../..");
const legacyThreeAddonsPrefix = ["three", "examples", "jsm"].join("/");
const ignoredDirectoryNames = new Set([".git", ".vite", "coverage", "dist", "node_modules"]);
const sourceFileExtension = /\.(?:[cm]?[jt]sx?|d\.ts)$/;

function collectGameSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectoryNames.has(entry.name) ? [] : collectGameSourceFiles(entryPath);
    }
    return entry.isFile() && sourceFileExtension.test(entry.name) ? [entryPath] : [];
  });
}

describe("Three.js add-on import policy", () => {
  it("uses the public three/addons alias throughout the game app", () => {
    const offenders = collectGameSourceFiles(gameAppRoot)
      .filter((filePath) => filePath !== testFilePath)
      .filter((filePath) => readFileSync(filePath, "utf8").includes(legacyThreeAddonsPrefix))
      .map((filePath) => relative(gameAppRoot, filePath))
      .sort();

    expect(offenders).toEqual([]);
  });
});
