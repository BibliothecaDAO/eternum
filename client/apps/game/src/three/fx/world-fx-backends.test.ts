import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { resolveRendererFxCapabilities } from "../renderer-fx-capabilities";
import { createWorldFxBackend } from "./world-fx-backends";

function createTexture(): THREE.Texture {
  return new THREE.Texture();
}

function createRectangularTexture(width: number, height: number): THREE.Texture {
  const texture = new THREE.Texture();
  texture.image = { height, width };
  return texture;
}

function collectObjectTypes(root: THREE.Object3D): string[] {
  const types: string[] = [];
  root.traverse((node) => {
    types.push(node.type);
  });
  return types;
}

function findFirstMesh(root: THREE.Object3D): THREE.Mesh | undefined {
  let mesh: THREE.Mesh | undefined;
  root.traverse((node) => {
    if (!mesh && node instanceof THREE.Mesh) {
      mesh = node;
    }
  });
  return mesh;
}

describe("createWorldFxBackend", () => {
  it("selects the legacy sprite backend when sprite scene fx are supported", () => {
    const backend = createWorldFxBackend({
      capabilities: resolveRendererFxCapabilities({
        activeMode: "legacy-webgl",
      }),
      scene: new THREE.Scene(),
    });

    expect(backend.kind).toBe("legacy-sprite");
  });

  it("selects the webgpu billboard backend when sprite scene fx are unavailable", () => {
    const backend = createWorldFxBackend({
      capabilities: resolveRendererFxCapabilities({
        activeMode: "webgpu",
      }),
      scene: new THREE.Scene(),
    });

    expect(backend.kind).toBe("webgpu-billboard");
  });
});

describe("webgpu billboard sizing", () => {
  it("preserves rectangular texture aspect ratio instead of forcing a square quad", () => {
    const scene = new THREE.Scene();
    const backend = createWorldFxBackend({
      capabilities: resolveRendererFxCapabilities({
        activeMode: "webgpu",
      }),
      scene,
    });

    backend.spawnIconFx({
      animate: (fx) => {
        fx.setOpacity(1);
        return true;
      },
      isInfinite: true,
      size: 1.25,
      texture: createRectangularTexture(128, 64),
      type: "travel",
      x: 0,
      y: 0,
      z: 0,
    });

    const mesh = findFirstMesh(scene);
    expect(mesh).toBeDefined();
    expect(mesh?.scale.x).toBeCloseTo(2.5);
    expect(mesh?.scale.y).toBeCloseTo(1.25);
  });
});

describe.each([
  {
    activeMode: "legacy-webgl" as const,
    expectedKind: "legacy-sprite",
    expectedObjectType: "Sprite",
  },
  {
    activeMode: "webgpu" as const,
    expectedKind: "webgpu-billboard",
    expectedObjectType: "Mesh",
  },
])("world fx icon lifecycle in $expectedKind", ({ activeMode, expectedKind, expectedObjectType }) => {
  it("spawns a finite-order icon effect and cleans it up after end()", async () => {
    const scene = new THREE.Scene();
    const backend = createWorldFxBackend({
      capabilities: resolveRendererFxCapabilities({
        activeMode,
      }),
      scene,
    });

    const handle = backend.spawnIconFx({
      animate: (fx) => {
        fx.setOpacity(1);
        return true;
      },
      isInfinite: true,
      size: 1.25,
      texture: createTexture(),
      type: "travel",
      x: 4,
      y: 5,
      z: 6,
    });

    expect(backend.kind).toBe(expectedKind);
    expect(scene.children).toHaveLength(1);

    const group = scene.children[0] as THREE.Group;
    const objectTypes = collectObjectTypes(group);
    expect(group.renderOrder).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(objectTypes).toContain(expectedObjectType);

    if (activeMode === "webgpu") {
      expect(objectTypes).not.toContain("Sprite");
    }

    handle.end();
    backend.update(1);
    await handle.promise;

    expect(scene.children).toHaveLength(0);
  });
});
