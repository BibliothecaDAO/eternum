import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { vi } from "vitest";

vi.mock("@bibliothecadao/types", () => ({
  ResourcesIds: { StaminaRelic1: 1 },
}));

vi.mock("@/three/constants", () => ({
  HEX_SIZE: 1,
}));

import { SelectionPulseManager } from "./selection-pulse-manager";
import { resolveSelectionPulsePalette } from "./worldmap-interaction-palette";

describe("SelectionPulseManager material ownership", () => {
  it("keeps primary pulse material state isolated per scene manager", () => {
    const first = new SelectionPulseManager(new THREE.Scene());
    const second = new SelectionPulseManager(new THREE.Scene());

    first.setPulseColor(new THREE.Color("#ff0000"), new THREE.Color("#ffffff"));
    second.setPulseColor(new THREE.Color("#00ff00"), new THREE.Color("#0000ff"));
    first.setPulseIntensity(0.2);
    second.setPulseIntensity(0.8);

    const firstMaterial = (first as any).pulseMesh.material as THREE.MeshBasicMaterial;
    const secondMaterial = (second as any).pulseMesh.material as THREE.MeshBasicMaterial;

    expect(firstMaterial).not.toBe(secondMaterial);
    expect(firstMaterial.color.getHex()).toBe(0xff0000);
    expect(secondMaterial.color.getHex()).toBe(0x00ff00);
    expect(firstMaterial.opacity).toBeCloseTo(0.2);
    expect(secondMaterial.opacity).toBeCloseTo(0.8);
  });

  it("advances pulse opacity independently per manager", () => {
    const first = new SelectionPulseManager(new THREE.Scene());
    const second = new SelectionPulseManager(new THREE.Scene());

    first.showSelection(0, 0, 1);
    second.showSelection(0, 0, 2);

    first.update(0.25);
    second.update(0.75);

    const firstMaterial = (first as any).pulseMesh.material as THREE.MeshBasicMaterial;
    const secondMaterial = (second as any).pulseMesh.material as THREE.MeshBasicMaterial;

    expect(firstMaterial.opacity).not.toBe(secondMaterial.opacity);
  });

  it("applies the shared army pulse palette contract", () => {
    const manager = new SelectionPulseManager(new THREE.Scene());
    const palette = resolveSelectionPulsePalette("army");

    manager.applyPulsePalette(palette);

    const material = (manager as any).pulseMesh.material as THREE.MeshBasicMaterial;

    expect(material.color.getHex()).toBe(palette.baseColor);
    expect(material.opacity).toBeCloseTo(palette.intensity);
  });
});

describe("selection scope", () => {
  it("reuses one ring while selection moves among four owned entities", () => {
    const scene = new THREE.Scene();
    const manager = new SelectionPulseManager(scene);
    for (const entityId of [1, 2, 3, 4]) {
      manager.showSelection(entityId * 2, 0, entityId);
      expect(scene.children.filter((child) => child.visible)).toHaveLength(1);
      expect(manager.getSelectedEntityId()).toBe(entityId);
    }
    expect(scene.children).toHaveLength(1);
    manager.hideSelection();
    expect(scene.children.filter((child) => child.visible)).toHaveLength(0);
    expect(manager.getSelectedEntityId()).toBeNull();
    manager.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
