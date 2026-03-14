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
    const firstUniforms = (first as any).hoverMaterialController.uniforms as Record<string, THREE.IUniform>;
    const secondUniforms = (second as any).hoverMaterialController.uniforms as Record<string, THREE.IUniform>;

    expect(firstMaterial).not.toBe(secondMaterial);
    expect(firstMaterial).not.toBeInstanceOf(THREE.ShaderMaterial);
    expect(firstUniforms.uBaseColor.value.getHex()).toBe(0xff0000);
    expect(secondUniforms.uBaseColor.value.getHex()).toBe(0x00ff00);
    expect(firstUniforms.intensity.value).toBeCloseTo(0.2);
    expect(secondUniforms.intensity.value).toBeCloseTo(0.8);
  });

  it("switches between contextual outline and generic fill palettes without stale fill state", () => {
    const manager = new HoverHexManager(new THREE.Scene());

    manager.showHover(0, 0);
    manager.applyHoverPalette(resolveHoverVisualPalette({ hasSelection: true, actionType: "move" as any }));

    const hoverHex = (manager as any).hoverHex as THREE.Mesh;
    expect(hoverHex.visible).toBe(false);

    manager.applyHoverPalette(resolveHoverVisualPalette({ hasSelection: false }));

    expect(hoverHex.visible).toBe(true);
    const uniforms = (manager as any).hoverMaterialController.uniforms as Record<string, THREE.IUniform>;

    expect(uniforms.centerAlpha.value as number).toBeCloseTo(0.12);
    expect(uniforms.intensity.value as number).toBeCloseTo(0.32);
  });

  it("keeps the fill detached while outline-only hover is active", () => {
    const scene = new THREE.Scene();
    const manager = new HoverHexManager(scene);

    manager.applyHoverPalette(resolveHoverVisualPalette({ hasSelection: true, actionType: "move" as any }));
    manager.showHover(4, 8);

    const hoverHex = (manager as any).hoverHex as THREE.Mesh;

    expect(manager.isHoverVisible()).toBe(true);
    expect(hoverHex.visible).toBe(false);
    expect(hoverHex.parent).toBeNull();
  });

  it("lifts the hover fill above the terrain layer for readability", () => {
    const manager = new HoverHexManager(new THREE.Scene());

    manager.showHover(4, 8);

    const hoverHex = (manager as any).hoverHex as THREE.Mesh;

    expect(hoverHex.position.y).toBeCloseTo(0.32);
  });

  it("disposes shader material and geometry ownership", () => {
    const manager = new HoverHexManager(new THREE.Scene());
    const hoverHex = (manager as any).hoverHex as THREE.Mesh;
    const material = hoverHex.material as THREE.MeshBasicMaterial;
    const geometryDispose = vi.spyOn(hoverHex.geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");

    manager.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect((manager as any).hoverHex).toBeNull();
  });

  it("reports hover diagnostics for mode, attachment, and material type", () => {
    const manager = new HoverHexManager(new THREE.Scene());

    manager.applyHoverPalette(resolveHoverVisualPalette({ hasSelection: true, actionType: "move" as any }));
    manager.showHover(2, 3);

    expect(manager.getDebugState()).toEqual({
      centerAlpha: 0.12,
      fillAttached: false,
      isVisible: true,
      materialType: "MeshBasicMaterial",
      scanWidth: 0.14,
      visualMode: "outline",
    });
  });
});
