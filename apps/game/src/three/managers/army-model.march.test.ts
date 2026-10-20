// @vitest-environment jsdom
import { BiomeType, TroopTier, TroopType } from "@bibliothecadao/types";
import { Euler, Scene, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import { ArmyModel } from "./army-model";

vi.mock("@/ui/config", async (importOriginal) => ({ ...(await importOriginal<object>()), FELT_CENTER: () => 0 }));

const ARMY = 7;
const GROUND = 0.03;
const tile = (column: number) => new Vector3(column * Math.sqrt(3), GROUND, 0);

const placedArmy = () => {
  const model = new ArmyModel(new Scene(), () => BiomeType.Grassland);
  model.updateInstance(ARMY, 0, tile(0), new Vector3(1, 1, 1), new Euler());
  return model;
};

// Plays frames until the march ends, returning the height the army is drawn at on each frame.
const marchHeights = (model: ArmyModel, frames = 600) => {
  const heights: number[] = [];
  for (let frame = 0; frame < frames && model.isEntityMoving(ARMY); frame++) {
    model.updateMovements(1 / 60);
    heights.push(model.getInstanceData(ARMY)!.position.y);
  }
  return heights;
};

describe("a marching army", () => {
  it("stands on its ground on every frame of its march and stops at its tile's centre", () => {
    const model = placedArmy();
    model.startMovement(ARMY, [tile(0), tile(1), tile(2)], 0, TroopType.Knight, TroopTier.T1);

    const heights = marchHeights(model);

    expect(model.isEntityMoving(ARMY)).toBe(false);
    expect(heights.length).toBeGreaterThan(30);
    expect(Math.max(...heights.map((height) => Math.abs(height - GROUND)))).toBeLessThan(1e-6);
    const rest = model.getInstanceData(ARMY)!.position;
    expect(rest.distanceTo(tile(2))).toBeLessThan(1e-9);
  });

  it("stays on its ground when a new order replaces its march halfway", () => {
    const model = placedArmy();
    model.startMovement(ARMY, [tile(0), tile(1), tile(2)], 0, TroopType.Knight, TroopTier.T1);
    const firstHalf = marchHeights(model, 30);

    // The army manager walks a replaced march on from where the army is drawn.
    const walkingFrom = model.getEntityWorldPosition(ARMY)!;
    model.startMovement(ARMY, [walkingFrom, tile(3)], 0, TroopType.Knight, TroopTier.T1);
    const secondHalf = marchHeights(model);

    expect(model.isEntityMoving(ARMY)).toBe(false);
    expect(Math.max(...[...firstHalf, ...secondHalf].map((height) => Math.abs(height - GROUND)))).toBeLessThan(1e-6);
    expect(model.getInstanceData(ARMY)!.position.y).toBe(GROUND);
  });
});
