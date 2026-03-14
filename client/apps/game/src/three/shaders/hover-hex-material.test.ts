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

  it("keeps the animated hover texture centered instead of reading like an offset tile", () => {
    const subject = createHoverHexMaterial();
    subject.setTime(0.6);

    const texture = subject.material.map as THREE.DataTexture;
    const data = texture.image.data as Uint8Array;
    const size = texture.image.width as number;
    let weightedX = 0;
    let weightedY = 0;
    let totalAlpha = 0;
    let leftAlpha = 0;
    let rightAlpha = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const alpha = data[(y * size + x) * 4 + 3];
        weightedX += x * alpha;
        weightedY += y * alpha;
        totalAlpha += alpha;

        if (x < size / 2) {
          leftAlpha += alpha;
        } else {
          rightAlpha += alpha;
        }
      }
    }

    const centroidX = weightedX / totalAlpha;
    const centroidY = weightedY / totalAlpha;

    expect(centroidX).toBeGreaterThan(size * 0.44);
    expect(centroidX).toBeLessThan(size * 0.56);
    expect(centroidY).toBeGreaterThan(size * 0.44);
    expect(centroidY).toBeLessThan(size * 0.56);
    expect(leftAlpha / rightAlpha).toBeGreaterThan(0.9);
    expect(leftAlpha / rightAlpha).toBeLessThan(1.1);
  });

  it("keeps the hover selector texture stable across time samples", () => {
    const subject = createHoverHexMaterial();
    const texture = subject.material.map as THREE.DataTexture;

    subject.setTime(0);
    const firstFrame = new Uint8Array(texture.image.data as Uint8Array);

    subject.setTime(1.25);
    const secondFrame = texture.image.data as Uint8Array;

    expect(Array.from(secondFrame)).toEqual(Array.from(firstFrame));
  });

  it("drops the interior fill so the selector reads as an outline only", () => {
    const subject = createHoverHexMaterial();
    const texture = subject.material.map as THREE.DataTexture;
    const size = texture.image.width as number;
    const centerIndex = ((Math.floor(size / 2) * size) + Math.floor(size / 2)) * 4 + 3;
    const centerAlpha = (texture.image.data as Uint8Array)[centerIndex];

    expect(centerAlpha).toBe(0);
  });
});
