import { Group, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralMeleeConfig } from "./procedural-melee-config";
import { ProceduralMeleeController } from "./procedural-melee-controller";
import { resolveProceduralMeleeOffhand } from "./procedural-melee-weapon-catalog";

describe("procedural melee controller", () => {
  it("resolves a mounted downward attack and one contact generation", () => {
    const config = createDefaultProceduralMeleeConfig("paladin");
    const controller = new ProceduralMeleeController(config, true, 0);
    const root = new Group();
    expect(controller.attack(new Vector3(0, 0.5, 1.4))).toBe(true);

    let pose = controller.update(0, root, false);
    for (let step = 0; step < 180 && controller.consumeContactGeneration() === undefined; step += 1) {
      pose = controller.update(1 / 120, root, false);
    }

    expect(pose.mounted).toBe(true);
    expect(pose.attackStyle).toBe("smash");
    expect(pose.aimPitchRadians).toBeLessThan(0);
    expect(controller.getStats().contactCount).toBe(1);
  });

  it("eases the arms of gear that declares arm poses to guard when its bearer starts moving, and back when it stops", () => {
    const config = {
      ...createDefaultProceduralMeleeConfig("knight"),
      offhandId: "t1-knight-default-shield" as const,
      weaponId: "t1-knight-default-sword" as const,
    };
    const shield = resolveProceduralMeleeOffhand(config.offhandId).armPoses;
    if (!shield) throw new Error("The Knight's shield declares no arm poses");
    const controller = new ProceduralMeleeController(config, false, 0);
    const root = new Group();
    const shieldWristHeight = (moving: boolean, seconds: number) =>
      controller.update(seconds, root, moving).arms.left?.wrist[1];

    expect(shieldWristHeight(false, 1 / 60)).toBeCloseTo(shield.carry.wrist[1], 6);
    const firstStep = shieldWristHeight(true, 1 / 60) as number;
    expect(firstStep).toBeGreaterThan(shield.carry.wrist[1]);
    expect(firstStep).toBeLessThan(shield.carry.wrist[1] + (shield.guard.wrist[1] - shield.carry.wrist[1]) * 0.25);
    expect(shieldWristHeight(true, 2)).toBeCloseTo(shield.guard.wrist[1], 6);
    expect(shieldWristHeight(false, 1 / 60)).toBeLessThan(shield.guard.wrist[1]);
    expect(shieldWristHeight(false, 2)).toBeCloseTo(shield.carry.wrist[1], 6);
    expect(shieldWristHeight(true, Number.NaN)).toBeCloseTo(shield.carry.wrist[1], 6);
    expect(shieldWristHeight(true, 2)).toBeCloseTo(shield.guard.wrist[1], 6);
  });
});
