import { describe, expect, it } from "vitest";

import { ArmyMarches, INSTANCE_FLOATS, type MapArmy } from "./army-marches";

const army = (entityId: number, x: number, z: number, build: MapArmy["build"] = "knight"): MapArmy => ({
  entityId,
  at: { x, z },
  build,
  tint: [0.2, 0.6, 0.2],
});

describe("ArmyMarches", () => {
  it("stands a new army on its hex, on guard, in its side's colour", () => {
    const marches = new ArmyMarches();
    expect(marches.update([army(7, 3, 4)], 10)).toBe(true);
    const unit = Array.from(marches.instancesOf("knight"));
    expect(unit).toHaveLength(INSTANCE_FLOATS);
    expect([unit[0], unit[2]]).toEqual([3, 4]);
    // Its kind is the swordsman's (0), it guards (1), and it has no way to go.
    expect(unit.slice(5, 7)).toEqual([0, 1]);
    expect(unit.slice(8, 11)).toEqual([0, 0, 0]);
    expect(unit.slice(16, 19).map((value) => Math.round(value * 10) / 10)).toEqual([0.2, 0.6, 0.2]);
  });

  it("walks an army from where it stood to its new hex, facing it", () => {
    const marches = new ArmyMarches();
    marches.update([army(7, 0, 0)], 0);
    expect(marches.update([army(7, 3, 4)], 20)).toBe(true);
    const unit = Array.from(marches.instancesOf("knight"));
    // It sets off from the old hex at second 20, marches (4), five units, toward the new hex.
    expect([unit[0], unit[2]]).toEqual([0, 0]);
    expect(unit[6]).toBe(4);
    expect(unit[7]).toBeCloseTo(Math.atan2(3, 4), 5);
    expect(unit[8]).toBeCloseTo(5, 5);
    expect(unit[11]).toBe(20);
  });

  it("turns an army ordered again mid-march from where it had got to", () => {
    const marches = new ArmyMarches();
    marches.update([army(7, 0, 0)], 0);
    marches.update([army(7, 9, 0)], 0);
    // Five seconds on, at 0.9 a second, it is 4.5 along; it is sent back.
    marches.update([army(7, 0, 0)], 5);
    const unit = Array.from(marches.instancesOf("knight"));
    expect(unit[0]).toBeCloseTo(4.5, 5);
    expect(unit[8]).toBeCloseTo(4.5, 5);
  });

  it("says nothing changed when the facts are the same, and drops an army that is gone", () => {
    const marches = new ArmyMarches();
    marches.update([army(7, 0, 0), army(8, 1, 1, "paladin")], 0);
    expect(marches.update([army(7, 0, 0), army(8, 1, 1, "paladin")], 3)).toBe(false);
    expect(marches.update([army(7, 0, 0)], 4)).toBe(true);
    expect(marches.instancesOf("paladin")).toHaveLength(0);
    expect(marches.instancesOf("knight")).toHaveLength(INSTANCE_FLOATS);
  });
});

describe("an army that strikes", () => {
  it("faces what it strikes and strikes from that moment, where it stands", () => {
    const marches = new ArmyMarches();
    marches.update([army(7, 3, 4)], 0);
    expect(marches.strike(7, { x: 3, z: 9 }, 12)).toBe(true);
    const unit = Array.from(marches.instancesOf("knight"));
    // It strikes (2) from its own hex, facing south, with no way to go, from second 12.
    expect([unit[0], unit[2]]).toEqual([3, 4]);
    expect(unit[6]).toBe(2);
    expect(unit[7]).toBeCloseTo(0, 5);
    expect(unit[8]).toBe(0);
    expect(unit[11]).toBe(12);
  });

  it("strikes once its march has ended, and not while it still walks", () => {
    const marches = new ArmyMarches();
    marches.update([army(7, 0, 0)], 0);
    marches.update([army(7, 9, 0)], 0);
    expect(marches.strike(7, { x: 10, z: 0 }, 5)).toBe(false);
    expect(Array.from(marches.instancesOf("knight"))[6]).toBe(4);
    expect(marches.strike(7, { x: 10, z: 0 }, 11)).toBe(true);
    const unit = Array.from(marches.instancesOf("knight"));
    expect([unit[0], unit[6]]).toEqual([9, 2]);
  });

  it("walks on when the facts move it, its strike forgotten", () => {
    const marches = new ArmyMarches();
    marches.update([army(7, 0, 0)], 0);
    marches.strike(7, { x: 1, z: 0 }, 1);
    marches.update([army(7, 3, 0)], 2);
    expect(Array.from(marches.instancesOf("knight"))[6]).toBe(4);
    marches.update([army(7, 3, 0)], 30);
    expect(marches.strike(7, { x: 4, z: 0 }, 31)).toBe(true);
  });

  it("is no strike for an army the map does not hold", () => {
    expect(new ArmyMarches().strike(7, { x: 1, z: 0 }, 1)).toBe(false);
  });
});

describe("a land drawn round another origin", () => {
  it("keeps an army's march where it was on the land", () => {
    const marches = new ArmyMarches();
    marches.update([army(7, 0, 0)], 0);
    marches.update([army(7, 9, 0)], 0);
    marches.shift({ x: 100, z: -50 });
    // The facts read from the new origin place it on the same hex: nothing changed, and it walks on.
    expect(marches.update([army(7, 109, -50)], 5)).toBe(false);
    const unit = Array.from(marches.instancesOf("knight"));
    expect([unit[0], unit[2], unit[6], unit[8], unit[11]]).toEqual([100, -50, 4, 9, 0]);
    expect(marches.positions(5).get(7)).toEqual({ x: 104.5, z: -50 });
  });
});
