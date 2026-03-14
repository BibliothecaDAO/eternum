import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("@/three/constants", () => ({
  HEX_SIZE: 1,
}));

import { createHoverHexMaterial } from "./hover-hex-material";

function readLocalSource(fileName: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, fileName), "utf8");
}

describe("hover hex material factory", () => {
  it("creates an isolated renderer-safe material with the expected control surface", () => {
    const first = createHoverHexMaterial();
    const second = createHoverHexMaterial();

    expect(first.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(first.material).not.toBeInstanceOf(THREE.ShaderMaterial);
    expect(first.material).not.toBe(second.material);
    expect(first.uniforms).not.toBe(second.uniforms);
    expect(first.material.transparent).toBe(true);
    expect(first.material.depthWrite).toBe(false);
    expect(first.material.map).toBeInstanceOf(THREE.DataTexture);
    expect(Object.keys(first.uniforms).sort()).toEqual([
      "accentColor",
      "borderThickness",
      "centerAlpha",
      "innerRingThickness",
      "intensity",
      "scanSpeed",
      "scanWidth",
      "time",
      "uBaseColor",
    ]);
  });

  it("keeps the hover effect off the raw shader path", () => {
    const factorySource = readLocalSource("hover-hex-material.ts");
    const managerSource = readLocalSource("../managers/hover-hex-manager.ts");
    const worldmapSource = readLocalSource("../scenes/worldmap.tsx");

    expect(factorySource).toMatch(/new THREE\.DataTexture\(/);
    expect(factorySource).toMatch(/new THREE\.MeshBasicMaterial\(/);
    expect(factorySource).not.toMatch(/new THREE\.ShaderMaterial\(/);
    expect(managerSource).not.toMatch(/new THREE\.ShaderMaterial\(/);
    expect(worldmapSource).not.toMatch(/new THREE\.ShaderMaterial\(/);
  });
});
