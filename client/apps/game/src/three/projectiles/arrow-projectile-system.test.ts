import { Color, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { ArrowProjectileSystem } from "./arrow-projectile-system";

describe("arrow projectile system", () => {
  it("uses one bounded pool and sticks a swept arrow to its target", () => {
    const system = createSystem(4);
    const impacts: boolean[] = [];
    system.onImpact(({ targetHit }) => impacts.push(targetHit));
    system.spawnVolley({
      color: new Color("#62d8ff"),
      count: 1,
      flightSeconds: 0.5,
      origin: new Vector3(0, 1, 0),
      seed: 1,
      spreadDegrees: 0,
      target: new Vector3(0, 1, 4),
      targetRadius: 0.2,
    });

    for (let step = 0; step < 60; step += 1) system.stepOnce();

    expect(system.getStats()).toMatchObject({ activeCount: 1, flyingCount: 0, hitCount: 1, stuckCount: 1 });
    expect(impacts).toEqual([true]);
    system.dispose();
  });

  it("drops an old cosmetic arrow rather than growing past capacity", () => {
    const system = createSystem(2);
    for (let index = 0; index < 3; index += 1) {
      system.spawnVolley({
        color: "#ffffff",
        count: 1,
        flightSeconds: 1,
        origin: new Vector3(index, 2, 0),
        seed: index + 1,
        spreadDegrees: 0,
        target: new Vector3(index, 2, 10),
        targetRadius: 0.1,
      });
    }

    expect(system.getStats()).toMatchObject({ activeCount: 2, capacity: 2, droppedCount: 1, spawnedCount: 3 });
    system.reset();
    expect(system.getStats()).toMatchObject({ activeCount: 0, droppedCount: 0, spawnedCount: 0 });
    system.dispose();
  });
});

function createSystem(capacity: number): ArrowProjectileSystem {
  return new ArrowProjectileSystem({
    capacity,
    fixedStep: 1 / 120,
    gravity: -8,
    maxSubsteps: 8,
    stickSeconds: 2,
    sweepRadius: 0.02,
    visualScale: 1,
  });
}
