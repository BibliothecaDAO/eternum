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
});
