// @vitest-environment node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const SRC_ROOT = join(process.cwd(), "src");
const ALLOWED_SONNER_IMPORTS = new Set(["ui/shared/components/toaster.tsx", "ui/shared/game-toast.tsx"]);

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return collectSourceFiles(fullPath);
    if (!/\.(ts|tsx)$/.test(entry)) return [];
    return [fullPath];
  });

describe("game toast source", () => {
  it("routes game-client Sonner usage through the shared gameToast wrapper", () => {
    const directSonnerImports = collectSourceFiles(SRC_ROOT)
      .map((filePath) => ({
        filePath,
        source: readFileSync(filePath, "utf8"),
      }))
      .filter(({ source }) => /from\s+["']sonner["']/.test(source))
      .map(({ filePath }) => relative(SRC_ROOT, filePath))
      .filter((relativePath) => !ALLOWED_SONNER_IMPORTS.has(relativePath));

    expect(directSonnerImports).toEqual([]);
  });
});
