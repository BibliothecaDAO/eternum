import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The renderer's node pipeline captures an InstancedMesh's instanceMatrix /
 * instanceColor / morphTexture objects at the mesh's FIRST DRAW and uploads GPU
 * data from the captured objects' versions forever (three r184 InstanceNode /
 * morph nodes). Reassigning any of them afterwards permanently freezes the mesh
 * on the GPU while CPU-side reads stay correct — the "ghost armies" bug.
 *
 * Rule: these properties may only be assigned where the mesh is created, before
 * it can ever render. Growth is forbidden; capacity is fixed at creation.
 */

const currentDir = dirname(fileURLToPath(import.meta.url));
const threeRoot = resolve(currentDir);

// Every assignment must be inside one of these files' creation paths. Adding a
// file here requires proving the mesh cannot have rendered before the write.
const ALLOWED_ASSIGNMENT_FILES = new Set([
  // Mesh factory: assigns instanceColor right after `new InstancedMesh(...)`.
  "managers/army-model.ts",
  // Fixed-capacity attribute created immediately after mesh construction.
  "managers/highlight-hex-manager.ts",
  // Composite biome meshes are built fresh per chunk composite and only then
  // added to the scene; the (re)assignment happens before their first draw.
  "scenes/worldmap.tsx",
]);

const FORBIDDEN_ASSIGNMENT = /\.(instanceMatrix|instanceColor|morphTexture)\s*=(?!=)/;

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
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
}

describe("instanced GPU buffer immutability", () => {
  it("never reassigns instanceMatrix/instanceColor/morphTexture outside allowlisted creation paths", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(threeRoot)) {
      const relativePath = relative(threeRoot, filePath).replaceAll("\\", "/");
      const lines = readFileSync(filePath, "utf8").split("\n");

      lines.forEach((line, index) => {
        if (!FORBIDDEN_ASSIGNMENT.test(line)) return;
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
        if (ALLOWED_ASSIGNMENT_FILES.has(relativePath)) return;
        violations.push(`${relativePath}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(violations, `post-creation instanced buffer reassignment:\n${violations.join("\n")}`).toEqual([]);
  });
});
