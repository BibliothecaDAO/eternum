import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FXManager } from "./fx-manager";

describe("FXManager", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not skip FX creation when texture is still loading", () => {
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(() => new THREE.Texture());

    const scene = new THREE.Scene();
    const fxManager = new FXManager(scene, 1);

    const { instance } = fxManager.playFxAtCoords("travel", 0, 0, 0, 1, "Traveling", true);

    expect(instance).toBeDefined();

    fxManager.destroy();
  });
});
