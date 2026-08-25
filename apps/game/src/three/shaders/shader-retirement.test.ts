import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function resolveShaderPath(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return resolve(currentDir, filename);
}

describe("phase 3 shader retirement", () => {
  it("removes dead points and path shader helpers once active renderers are ported", () => {
    expect(existsSync(resolveShaderPath("points-label-material.ts"))).toBe(false);
    expect(existsSync(resolveShaderPath("path-line-material.ts"))).toBe(false);
  });
});
