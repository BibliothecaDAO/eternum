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

describe("SelectionPulseManager material ownership", () => {
  it("keeps primary pulse material state isolated per scene manager", () => {
    const first = new SelectionPulseManager(new THREE.Scene());
    const second = new SelectionPulseManager(new THREE.Scene());

    first.setPulseColor(new THREE.Color("#ff0000"), new THREE.Color("#ffffff"));
    second.setPulseColor(new THREE.Color("#00ff00"), new THREE.Color("#0000ff"));
    first.setPulseIntensity(0.2);
    second.setPulseIntensity(0.8);

    const firstMaterial = (first as any).pulseMesh.material as THREE.ShaderMaterial;
    const secondMaterial = (second as any).pulseMesh.material as THREE.ShaderMaterial;

    expect(firstMaterial.uniforms.color.value.getHex()).toBe(0xff0000);
    expect(secondMaterial.uniforms.color.value.getHex()).toBe(0x00ff00);
    expect(firstMaterial.uniforms.pulseColor.value.getHex()).toBe(0xffffff);
    expect(secondMaterial.uniforms.pulseColor.value.getHex()).toBe(0x0000ff);
    expect(firstMaterial.uniforms.opacity.value).toBe(0.2);
    expect(secondMaterial.uniforms.opacity.value).toBe(0.8);
  });

  it("advances animation time independently per manager", () => {
    const first = new SelectionPulseManager(new THREE.Scene());
    const second = new SelectionPulseManager(new THREE.Scene());

    first.showSelection(0, 0, 1);
    second.showSelection(0, 0, 2);

    first.update(0.25);
    second.update(0.75);

    const firstMaterial = (first as any).pulseMesh.material as THREE.ShaderMaterial;
    const secondMaterial = (second as any).pulseMesh.material as THREE.ShaderMaterial;

    expect(firstMaterial.uniforms.time.value).toBeCloseTo(0.25);
    expect(secondMaterial.uniforms.time.value).toBeCloseTo(0.75);
  });
});
