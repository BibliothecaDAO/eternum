import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PlayerIndicatorManager } from "./player-indicator-manager";

describe("PlayerIndicatorManager", () => {
  it("marks bounds dirty when an existing indicator moves", () => {
    const scene = new THREE.Scene();
    const manager = new PlayerIndicatorManager(scene, 8);
    const color = new THREE.Color("#ff0000");

    manager.updateIndicator(101, new THREE.Vector3(0, 0, 0), color, 2);
    manager.computeBoundingSphere();
    expect(manager.isBoundingSphereDirty()).toBe(false);

    manager.updateIndicator(101, new THREE.Vector3(12, 0, 0), color, 2);

    expect(manager.isBoundingSphereDirty()).toBe(true);
  });
});
