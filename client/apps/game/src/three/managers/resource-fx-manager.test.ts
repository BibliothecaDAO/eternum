import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveRendererFxCapabilities } from "../renderer-fx-capabilities";
import { ResourceFXManager } from "./resource-fx-manager";

function collectObjectTypes(root: THREE.Object3D): string[] {
  const types: string[] = [];
  root.traverse((node) => {
    types.push(node.type);
  });
  return types;
}

describe("ResourceFXManager", () => {
  beforeEach(() => {
    class FakeElement {
      public className = "";
      public ownerDocument = {
        defaultView: {
          Element: FakeElement,
          getComputedStyle: () => ({
            display: "block",
          }),
        },
      };
      public parentNode = null;
      public remove = vi.fn();
      public setAttribute = vi.fn();
      public style = {};
      public textContent = "";
    }

    vi.stubGlobal("document", {
      createElement: () => new FakeElement(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("routes resource fx through the webgpu-safe backend and cleans up active effects", async () => {
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation((_, onLoad) => {
      const texture = new THREE.Texture();
      onLoad?.(texture);
      return texture;
    });

    const scene = new THREE.Scene();
    const manager = new ResourceFXManager(scene, 1.2, {
      capabilities: resolveRendererFxCapabilities({
        activeMode: "webgpu",
      }),
    });

    const promise = manager.playResourceFxAtCoords(1, 5, 0, 0, 0, {
      duration: 0.2,
      fadeOutDuration: 0.1,
      labelText: "Food",
    });

    await Promise.resolve();

    expect(manager.hasActiveFx()).toBe(true);
    expect(scene.children.length).toBeGreaterThan(0);
    expect(collectObjectTypes(scene)).toContain("Mesh");
    expect(collectObjectTypes(scene)).not.toContain("Sprite");

    manager.update(0.2);
    manager.update(0.2);
    manager.update(0.2);
    await promise;

    expect(manager.hasActiveFx()).toBe(false);
    expect(scene.children).toHaveLength(0);
  });
});
