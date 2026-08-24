import { describe, expect, it } from "vitest";

import { applyProceduralUnitConfigPatch, createDefaultProceduralUnitConfig } from "./procedural-unit-config";

describe("procedural unit configuration", () => {
  it("defaults to a mounted Paladin and keeps rider/mount tiers synchronized when patched", () => {
    const config = createDefaultProceduralUnitConfig();
    const upgraded = applyProceduralUnitConfigPatch(config, {
      humanoid: { tier: 3 },
      horse: { tier: 3 },
    });

    expect(upgraded.kind).toBe("paladin");
    expect(upgraded.humanoid.animationMode).toBe("mounted");
    expect(upgraded.humanoid.tier).toBe(3);
    expect(upgraded.horse.tier).toBe(3);
  });

  it("restores a locomotion pose when a mounted unit becomes a foot unit", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "knight" });
    expect(config.humanoid.animationMode).toBe("walk");
  });

  it("keeps mounted and naval variation seeds synchronized with the unit identity", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
      humanoid: { seed: 9_001 },
    });
    expect(config.horse.seed).toBe(9_001);
    expect(config.boat.seed).toBe(9_001);
  });

  it("adds the normalized naval runtime without changing the character defaults", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
      boat: { broadsideCannons: 20, speed: 2.4 },
      kind: "boat",
    });

    expect(config.kind).toBe("boat");
    expect(config.boat.broadsideCannons).toBe(6);
    expect(config.boat.speed).toBe(2.4);
    expect(config.humanoid.animationMode).toBe("walk");
  });

  it("adds a normalized archer presentation without changing the shared humanoid config", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
      kind: "archer",
      archer: { projectileCapacity: 2, targetDistance: 7 },
    });

    expect(config.kind).toBe("archer");
    expect(config.archer.projectileCapacity).toBe(16);
    expect(config.archer.targetDistance).toBe(7);
    expect(config.humanoid.animationMode).toBe("walk");
  });

  it("switches melee defaults by unit domain while preserving explicit cosmetic choices", () => {
    const knight = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "knight" });
    const customizedPaladin = applyProceduralUnitConfigPatch(knight, {
      kind: "paladin",
      melee: { weaponId: "winter-rider-battleaxe", offhandId: "light-cavalry-shield" },
    });

    expect(knight.melee.weaponId).toBe("iron-longsword");
    expect(customizedPaladin.melee.weaponId).toBe("winter-rider-battleaxe");
    expect(customizedPaladin.melee.offhandId).toBe("light-cavalry-shield");
  });
});
