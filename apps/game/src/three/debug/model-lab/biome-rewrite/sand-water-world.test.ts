import { describe, expect, it } from "vitest";
import { createSandWaterWorld, resolveCoastalStage } from "./sand-water-world";

describe("sand-and-water world", () => {
  it("draws the same ground for the same seed and coordinates", () => {
    const first = createSandWaterWorld();
    const second = createSandWaterWorld();
    for (let step = 0; step < 200; step++) {
      const x = -18 + (step % 20) * 1.9,
        z = -12 + Math.floor(step / 20) * 2.4;
      expect(second.groundAt(x, z)).toBe(first.groundAt(x, z));
      expect(second.dunesAt(x, z)).toBe(first.dunesAt(x, z));
    }
  });

  it("puts every land hex centre above the water and every sea hex centre below it", () => {
    const world = createSandWaterWorld();
    const kinds = new Set(world.cells.map((cell) => cell.kind));
    expect([...kinds].toSorted()).toEqual(["beach", "deep", "desert", "shallow"]);
    for (const cell of world.cells) {
      const ground = world.groundAt(cell.x, cell.z);
      if (cell.kind === "deep" || cell.kind === "shallow") expect(ground).toBeLessThan(0);
      else expect(ground).toBeGreaterThanOrEqual(0);
    }
  });

  it("stands the army on a coastal sand hex beside the sea and the realm inland behind it", () => {
    const world = createSandWaterWorld();
    const { realm, army } = resolveCoastalStage(world);
    expect(["beach", "desert"]).toContain(army.kind);
    expect(["beach", "desert"]).toContain(realm.kind);
    expect(Math.hypot(realm.x - army.x, realm.z - army.z)).toBeLessThan(1.8);
  });
});
