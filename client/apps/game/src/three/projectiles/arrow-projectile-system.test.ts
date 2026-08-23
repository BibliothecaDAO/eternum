import { Color, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import { ArrowProjectileSystem } from "./arrow-projectile-system";
import type { ProjectileHitQuery } from "./projectile-hit-query";

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

  it("emits stable ownership and target metadata from an injected swept query", () => {
    const query: ProjectileHitQuery = {
      sweepSphere: ({ from, intendedTargetEntityId, to }) => ({
        fraction: 0.5,
        material: "metal",
        normal: new Vector3(0, 0, -1),
        partId: "chest",
        point: new Vector3().copy(from).lerp(to, 0.5),
        targetEntityId: intendedTargetEntityId,
      }),
    };
    const system = createSystem(4, query);
    const impacts: Array<Parameters<Parameters<typeof system.onImpact>[0]>[0]> = [];
    system.onImpact((event) => impacts.push(event));
    system.spawnVolley({
      authority: "indexed-replay",
      color: "#ffffff",
      count: 1,
      flightSeconds: 1,
      origin: new Vector3(0, 1, 0),
      ownerEntityId: 7,
      presentationId: "battle:4",
      seed: 2,
      spreadDegrees: 0,
      target: new Vector3(0, 1, 10),
      targetEntityId: 9,
      targetRadius: 0.2,
    });
    system.stepOnce();

    expect(impacts).toHaveLength(1);
    expect(impacts[0]).toMatchObject({
      authority: "indexed-replay",
      material: "metal",
      ownerEntityId: 7,
      partId: "chest",
      targetEntityId: 9,
      targetHit: true,
    });
    expect(impacts[0].impactId).toMatch(/^battle:4:\d+:1$/);
    system.dispose();
  });

  it("does not attribute a ground miss to the intended target", () => {
    const system = createSystem(4, { sweepSphere: () => undefined });
    const impacts: Array<Parameters<Parameters<typeof system.onImpact>[0]>[0]> = [];
    system.onImpact((event) => impacts.push(event));
    system.spawnVolley({
      color: "#ffffff",
      count: 1,
      flightSeconds: 0.2,
      origin: new Vector3(0, 0.2, 0),
      ownerEntityId: 1,
      seed: 3,
      spreadDegrees: 0,
      target: new Vector3(0, -0.2, 1),
      targetEntityId: 2,
      targetRadius: 0.1,
    });

    for (let step = 0; step < 60 && impacts.length === 0; step += 1) system.stepOnce();

    expect(impacts[0]).toMatchObject({ material: "ground", targetEntityId: undefined, targetHit: false });
    system.dispose();
  });

  it("uses the cached target volume when the query does not own that entity", () => {
    const sweepSphere = vi.fn();
    const system = createSystem(4, { hasTarget: () => false, sweepSphere });
    const impacts: Array<Parameters<Parameters<typeof system.onImpact>[0]>[0]> = [];
    system.onImpact((event) => impacts.push(event));
    system.spawnVolley({
      color: "#ffffff",
      count: 1,
      flightSeconds: 0.5,
      origin: new Vector3(0, 1, 0),
      seed: 4,
      spreadDegrees: 0,
      target: new Vector3(0, 1, 4),
      targetEntityId: 9,
      targetRadius: 0.2,
    });

    for (let step = 0; step < 60 && impacts.length === 0; step += 1) system.stepOnce();

    expect(sweepSphere).not.toHaveBeenCalled();
    expect(impacts[0]).toMatchObject({ targetEntityId: 9, targetHit: true });
    system.dispose();
  });
});

function createSystem(capacity: number, hitQuery?: ProjectileHitQuery): ArrowProjectileSystem {
  return new ArrowProjectileSystem(
    {
      capacity,
      fixedStep: 1 / 120,
      gravity: -8,
      maxSubsteps: 8,
      stickSeconds: 2,
      sweepRadius: 0.02,
      visualScale: 1,
    },
    hitQuery,
  );
}
