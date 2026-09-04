// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const PUBLIC_DIRECTORY = resolve("public/textures/procedural-terrain");
const FULL_SOURCE_MANIFEST_PATH = resolve("scripts/terrain-ground/ground-material-full-source.json");
const BUILD_SCRIPT_PATH = resolve("scripts/terrain-ground/build-ground-texture-arrays.mjs");

describe("terrain ground texture G0 assets", () => {
  it("ships the complete eight-surface catalog inside the transfer budget", () => {
    const runtimeManifest = readJson(resolve(PUBLIC_DIRECTORY, "ground-materials.json"));
    const albedoHeight = readKtx2(resolve(PUBLIC_DIRECTORY, runtimeManifest.textures.albedoHeight.file));
    const normalMaterial = readKtx2(resolve(PUBLIC_DIRECTORY, runtimeManifest.textures.normalMaterial.file));

    expect(runtimeManifest.layers.map(({ id }) => id)).toEqual([
      "sand",
      "dry-earth",
      "soil",
      "grass",
      "litter",
      "stone",
      "snow",
      "ash",
    ]);
    expect(albedoHeight).toMatchObject({ height: 512, layers: 8, levels: 10, supercompression: 1, width: 512 });
    expect(normalMaterial).toMatchObject({ height: 512, layers: 8, levels: 10, supercompression: 2, width: 512 });
    expect(albedoHeight.sha256).toBe(runtimeManifest.textures.albedoHeight.sha256);
    expect(normalMaterial.sha256).toBe(runtimeManifest.textures.normalMaterial.sha256);
    expect(runtimeManifest.textures.albedoHeight.bytes + runtimeManifest.textures.normalMaterial.bytes).toBeLessThan(
      8 * 1024 * 1024,
    );
  });

  it("records full-catalog provenance in the exact runtime layer order", () => {
    const sourceManifest = readJson(FULL_SOURCE_MANIFEST_PATH);

    expect(sourceManifest.layers.map(({ id }) => id)).toEqual([
      "sand",
      "dry-earth",
      "soil",
      "grass",
      "litter",
      "stone",
      "snow",
      "ash",
    ]);
    sourceManifest.layers.forEach((layer) => {
      expect(Object.keys(layer.maps).toSorted()).toEqual(["albedo", "ao", "height", "normal", "roughness"]);
      Object.values(layer.maps).forEach((map) => {
        expect(map.md5).toMatch(/^[a-f0-9]{32}$/);
        expect(map.url).toMatch(/^https:\/\/dl\.polyhaven\.org\//);
      });
    });
  });

  it("keeps mip generation, array assembly, validation, and both compression modes in the build path", () => {
    const source = readFileSync(BUILD_SCRIPT_PATH, "utf8");

    expect(source).toContain('"--layers"');
    expect(source).toContain('"--generate-mipmap"');
    expect(source).toContain('"basis-lz"');
    expect(source).toContain('"uastc"');
    expect(source).toContain('"validate"');
  });
});

function readKtx2(path) {
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 12)).toEqual(
    Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  return {
    height: bytes.readUInt32LE(24),
    layers: bytes.readUInt32LE(32),
    levels: bytes.readUInt32LE(40),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    supercompression: bytes.readUInt32LE(44),
    width: bytes.readUInt32LE(20),
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
