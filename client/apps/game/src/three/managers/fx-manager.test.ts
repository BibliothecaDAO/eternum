import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FXManager } from "./fx-manager";

function readFXManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "fx-manager.ts"), "utf8");
}

describe("FXManager", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not skip FX creation when texture is still loading", () => {
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(() => new THREE.Texture());

    const scene = new THREE.Scene();
    const fxManager = new FXManager(scene, 1);

    const { instance } = fxManager.playFxAtCoords("travel", 0, 0, 0, 1, undefined, true);

    expect(instance).toBeDefined();

    fxManager.destroy();
  });

  it("removes the unused batched shader path from the active FX manager implementation", () => {
    const source = readFXManagerSource();

    expect(source).not.toMatch(/class BatchedFXSystem/);
    expect(source).not.toMatch(/new THREE\.ShaderMaterial\(/);
    expect(source).not.toMatch(/batchedSystems: Map/);
  });
});
