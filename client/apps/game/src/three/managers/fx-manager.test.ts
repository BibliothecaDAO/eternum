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

    const { instance } = fxManager.playFxAtCoords("travel", 0, 0, 0, 1, undefined, true);

    expect(instance).toBeDefined();

    fxManager.destroy();
  });

  it("can register and play a dynamic icon fx type", () => {
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(() => new THREE.Texture());

    const scene = new THREE.Scene();
    const fxManager = new FXManager(scene, 1);

    fxManager.ensureInfiniteIconFx("create-army-resource-34", "/images/resources/34.png");
    const { instance } = fxManager.playFxAtCoords("create-army-resource-34", 0, 0, 0, 1, undefined, true);

    expect(instance).toBeDefined();

    fxManager.destroy();
  });

  it("can register and play a dynamic ground icon fx type", () => {
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(() => new THREE.Texture());

    const scene = new THREE.Scene();
    const fxManager = new FXManager(scene, 1);

    fxManager.ensureInfiniteIconFx("create-army-resource-55", "/images/resources/55.png", { renderMode: "ground" });
    const { instance } = fxManager.playFxAtCoords("create-army-resource-55", 0, 0, 0, 1, undefined, true);

    expect(instance).toBeDefined();

    fxManager.destroy();
  });
});
