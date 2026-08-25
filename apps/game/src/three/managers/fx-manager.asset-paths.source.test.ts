// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("FXManager built-in asset paths", () => {
  it("registers shared world fx textures with absolute public paths", () => {
    const source = readSource("src/three/managers/fx-manager.ts");

    expect(source).toContain("const buildSharedFxTexturePath = (fileName: string): string => `/textures/${fileName}`;");
    expect(source).toContain('textureUrl: buildSharedFxTexturePath("skull.png")');
    expect(source).toContain('textureUrl: buildSharedFxTexturePath("compass.png")');
    expect(source).toContain('textureUrl: buildSharedFxTexturePath("travel.png")');
    expect(source).toContain('textureUrl: buildSharedFxTexturePath("attack.png")');
    expect(source).toContain('textureUrl: buildSharedFxTexturePath("defense.png")');
  });
});
