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

  it("uses ring geometry for ownership pulses instead of flat filled planes", () => {
    const manager = new SelectionPulseManager(new THREE.Scene());

    manager.showOwnershipPulses([{ x: 0, z: 0 }], new THREE.Color("#00aaff"), new THREE.Color("#ffffff"));

    const ownershipMesh = (manager as any).ownershipPulseMeshes[0] as THREE.Mesh;
    const shapes = (ownershipMesh.geometry as any).parameters.shapes;
    const primaryShape = Array.isArray(shapes) ? shapes[0] : shapes;

    expect(primaryShape.holes.length).toBeGreaterThan(0);
  });
});
