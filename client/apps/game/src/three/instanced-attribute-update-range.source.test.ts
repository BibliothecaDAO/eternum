import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(currentDir, "..");

const DOCUMENTED_DIRECT_UPLOADS = new Map([
  [
    "three/debug/three-chunk-debug-renderer.ts",
    // This fixture fills a new mesh completely before its first draw.
    new Set([
      "mesh.instanceMatrix.needsUpdate = true;",
      "if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;",
    ]),
  ],
  [
    "three/scenes/worldmap.tsx",
    // FL-08 owns replacing this lazy land-color allocation. The current site
    // already installs one active-prefix update range before setting the flag.
    new Set(["mesh.instanceColor.needsUpdate = true;"]),
  ],
]);

const BARE_INSTANCED_ATTRIBUTE_UPLOAD = /\.instance(?:Matrix|Color)!?\.needsUpdate\s*=\s*true/;

const collectSourceFiles = (directory: string, files: string[] = []): string[] => {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      collectSourceFiles(fullPath, files);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) {
      continue;
    }
    files.push(fullPath);
  }
  return files;
};

const isDocumentedDirectUpload = (relativePath: string, sourceLine: string): boolean => {
  return DOCUMENTED_DIRECT_UPLOADS.get(relativePath)?.has(sourceLine.trim()) ?? false;
};

describe("instanced attribute update ranges", () => {
  it("forbids bare runtime matrix and color uploads outside documented exceptions", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(sourceRoot)) {
      const relativePath = relative(sourceRoot, filePath).replaceAll("\\", "/");
      const lines = readFileSync(filePath, "utf8").split("\n");

      lines.forEach((line, index) => {
        if (!BARE_INSTANCED_ATTRIBUTE_UPLOAD.test(line)) return;
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
        if (isDocumentedDirectUpload(relativePath, line)) return;
        violations.push(`${relativePath}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(violations, `bare instanced attribute uploads:\n${violations.join("\n")}`).toEqual([]);
  });
});
