import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("@/three/constants", () => ({
  HEX_SIZE: 1,
}));

vi.mock("@/three/utils/utils", () => ({
  gltfLoader: {
    loadAsync: vi.fn(async () => ({ scene: new THREE.Group() })),
  },
}));

import { HoverHexManager } from "./hover-hex-manager";
import { resolveHoverVisualPalette } from "./worldmap-interaction-palette";

describe("HoverHexManager material ownership", () => {
  it("keeps hover material state isolated per manager", () => {
    const first = new HoverHexManager(new THREE.Scene());
    const second = new HoverHexManager(new THREE.Scene());

    first.setHoverColor(new THREE.Color("#ff0000"), new THREE.Color("#ffffff"));
    second.setHoverColor(new THREE.Color("#00ff00"), new THREE.Color("#0000ff"));
    first.setHoverIntensity(0.2);
    second.setHoverIntensity(0.8);

    const firstMaterial = (first as any).hoverHex.material as THREE.MeshBasicMaterial;
    const secondMaterial = (second as any).hoverHex.material as THREE.MeshBasicMaterial;

    expect(firstMaterial).not.toBe(secondMaterial);
    expect(firstMaterial.color.getHex()).toBe(0xff0000);
    expect(secondMaterial.color.getHex()).toBe(0x00ff00);
    expect(firstMaterial.opacity).toBeCloseTo(0.2);
    expect(secondMaterial.opacity).toBeCloseTo(0.8);
  });

  it("switches between contextual outline and generic fill palettes without stale fill state", () => {
    const manager = new HoverHexManager(new THREE.Scene());

    manager.showHover(0, 0);
    manager.applyHoverPalette(resolveHoverVisualPalette({ hasSelection: true, actionType: "move" as any }));

    const hoverHex = (manager as any).hoverHex as THREE.Mesh;
    expect(hoverHex.visible).toBe(false);

    manager.applyHoverPalette(resolveHoverVisualPalette({ hasSelection: false }));

    expect(hoverHex.visible).toBe(true);
    expect((hoverHex.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.32);
  });
});
