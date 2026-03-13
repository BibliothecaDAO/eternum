import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("@bibliothecadao/types", () => ({
  TroopType: {
    Knight: "Knight",
    Crossbowman: "Crossbowman",
    Paladin: "Paladin",
  },
  TroopTier: {
    T1: "T1",
    T2: "T2",
    T3: "T3",
  },
  ResourcesIds: {
    StaminaRelic1: 1,
  },
  getNeighborHexes: vi.fn(() => []),
}));

vi.mock("../constants", () => ({
  HEX_SIZE: 1,
}));

vi.mock("../utils", () => ({
  getWorldPositionForHex: vi.fn(() => new THREE.Vector3()),
}));

import { ThunderBoltManager } from "./thunderbolt-manager";

describe("ThunderBoltManager lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cancels scheduled thunderbolt spawns during destroy", () => {
    const manager = new ThunderBoltManager(new THREE.Scene(), {
      object: { position: new THREE.Vector3() },
      target: new THREE.Vector3(),
    });
    const createThunderBoltSpy = vi.spyOn(manager as never, "createThunderBolt").mockImplementation(() => undefined);
    vi.spyOn(manager as never, "getCenterHexFromCamera").mockReturnValue({ col: 0, row: 0 });
    vi.spyOn(manager as never, "getRandomHexesAroundCenter").mockReturnValue([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ]);

    manager.spawnThunderBolts();
    manager.destroy();
    vi.runAllTimers();

    expect(createThunderBoltSpy).not.toHaveBeenCalled();
  });
});
