import { TroopTier } from "@bibliothecadao/types";
import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { MeleeImpactSystem } from "./melee-impact-system";

describe("melee impact system", () => {
  it("pools impact presentations and releases them after their visual lifetime", () => {
    const system = new MeleeImpactSystem(2);
    const input = {
      direction: new Vector3(1, 0, 0),
      target: new Vector3(2, 0, 3),
      tier: TroopTier.T2,
    };

    expect(system.spawn(input)).toBe(true);
    expect(system.spawn(input)).toBe(true);
    expect(system.spawn(input)).toBe(false);
    expect(system.getStats()).toMatchObject({ activeCount: 2, droppedCount: 1, spawnedCount: 2 });

    for (let index = 0; index < 5; index += 1) system.update(0.1);
    expect(system.getStats().activeCount).toBe(0);
    system.dispose();
  });
});
