import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(sourceDir, "../..");

function readGamePackageJson(): {
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
} {
  return JSON.parse(readFileSync(resolve(appRoot, "package.json"), "utf8"));
}

function readCustomTypesSource(): string {
  return readFileSync(resolve(appRoot, "src/custom.d.ts"), "utf8");
}

describe("Three.js typing policy", () => {
  it("keeps the Three.js ambient types aligned with the runtime package version", () => {
    expect(readGamePackageJson().devDependencies?.["@types/three"]).toBe("^0.182.0");
  });

  it("keeps a dedicated WebGPU typing guard script", () => {
    expect(readGamePackageJson().scripts?.["test:three:types"]).toBe("tsc --noEmit --pretty false -p tsconfig.three-types.json");
  });

  it("does not mask the WebGPU renderer surface behind any-typed ambient declarations", () => {
    expect(readCustomTypesSource()).not.toMatch(/WebGPURenderer:\s*any/);
  });
});
