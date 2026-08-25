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

// Every assignment must be inside the function that creates and returns the
// mesh. File-wide exceptions would also permit unsafe writes after first draw.
const CREATION_ASSIGNMENT_SCOPES = [
  {
    file: "managers/army-model.ts",
    start: "private createInstancedMesh(",
    end: "// Buffers are never grown",
  },
  {
    file: "managers/highlight-hex-manager.ts",
    start: "const createMesh = (",
    end: "export class HighlightHexManager",
  },
  {
    file: "managers/instanced-biome.tsx",
    start: "private createBiomeInstancedMesh(",
    end: "private createNeutralLandColorAttribute(",
  },
] as const;

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

function isInsideCreationAssignmentScope(relativePath: string, source: string, offset: number): boolean {
  return CREATION_ASSIGNMENT_SCOPES.some((scope) => {
    if (scope.file !== relativePath) {
      return false;
    }
    const start = source.indexOf(scope.start);
    const end = source.indexOf(scope.end, start);
    return start >= 0 && end > start && offset >= start && offset < end;
  });
}

describe("instanced GPU buffer immutability", () => {
  it("never reassigns instanceMatrix/instanceColor/morphTexture outside mesh creation scopes", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(threeRoot)) {
      const relativePath = relative(threeRoot, filePath).replaceAll("\\", "/");
      const source = readFileSync(filePath, "utf8");
      const lines = source.split("\n");
      let offset = 0;

      lines.forEach((line, index) => {
        if (
          FORBIDDEN_ASSIGNMENT.test(line) &&
          !line.trimStart().startsWith("//") &&
          !line.trimStart().startsWith("*") &&
          !isInsideCreationAssignmentScope(relativePath, source, offset)
        ) {
          violations.push(`${relativePath}:${index + 1}: ${line.trim()}`);
        }
        offset += line.length + 1;
      });
    }

    expect(violations, `post-creation instanced buffer reassignment:\n${violations.join("\n")}`).toEqual([]);
  });
});
