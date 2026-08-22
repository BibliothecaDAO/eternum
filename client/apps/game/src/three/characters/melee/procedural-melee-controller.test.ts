import { Group, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralMeleeConfig } from "./procedural-melee-config";
import { ProceduralMeleeController } from "./procedural-melee-controller";

describe("procedural melee controller", () => {
  it("resolves a mounted downward attack and one contact generation", () => {
    const config = createDefaultProceduralMeleeConfig("paladin");
    const controller = new ProceduralMeleeController(config, true);
    const root = new Group();
    expect(controller.attack(new Vector3(0, 0.5, 1.4))).toBe(true);

    let pose = controller.update(0, root);
    for (let step = 0; step < 180 && controller.consumeContactGeneration() === undefined; step += 1) {
      pose = controller.update(1 / 120, root);
    }

    expect(pose.mounted).toBe(true);
    expect(pose.attackStyle).toBe("smash");
    expect(pose.aimPitchRadians).toBeLessThan(0);
    expect(controller.getStats().contactCount).toBe(1);
  });
});
