import { Group, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralMeleeConfig, resolveProceduralMeleeAttackVariants } from "./procedural-melee-config";
import { ProceduralMeleeController, type ProceduralMeleeBearerMotion } from "./procedural-melee-controller";
import { resolveProceduralMeleeOffhand } from "./procedural-melee-weapon-catalog";

describe("procedural melee controller", () => {
  it("resolves a mounted downward attack and one contact generation", () => {
    const config = createDefaultProceduralMeleeConfig("paladin");
    const controller = new ProceduralMeleeController(config, true, 0);
    const root = new Group();
    expect(controller.attack(new Vector3(0, 0.5, 1.4))).toBe(true);

    let pose = controller.update(0, root, "standing");
    for (let step = 0; step < 180 && controller.consumeContactGeneration() === undefined; step += 1) {
      pose = controller.update(1 / 120, root, "standing");
    }

    expect(pose.mounted).toBe(true);
    expect(pose.attackStyle).toBe("smash");
    expect(pose.aimPitchRadians).toBeLessThan(0);
    expect(controller.getStats().contactCount).toBe(1);
  });

  it("eases gear that declares states to guard when its bearer starts moving, and back when it stops", () => {
    const config = {
      ...createDefaultProceduralMeleeConfig("knight"),
      offhandId: "t1-knight-default-shield" as const,
      weaponId: "t1-knight-default-sword" as const,
    };
    const shield = resolveProceduralMeleeOffhand(config.offhandId).armPoses;
    if (!shield) throw new Error("The Knight's shield declares no arm states");
    const controller = new ProceduralMeleeController(config, false, 0);
    const root = new Group();
    const idle = shield.idle[0].wrist[1];
    const shieldWristHeight = (motion: ProceduralMeleeBearerMotion, seconds: number) =>
      controller.update(seconds, root, motion).arms.left?.wrist[1];

    expect(shieldWristHeight("standing", 1 / 60)).toBeCloseTo(idle, 6);
    const firstStep = shieldWristHeight("walking", 1 / 60) as number;
    expect(firstStep).toBeGreaterThan(idle);
    expect(firstStep).toBeLessThan(idle + (shield.guard.wrist[1] - idle) * 0.25);
    expect(shieldWristHeight("running", 2)).toBeCloseTo(shield.runGuard.wrist[1], 6);
    expect(shieldWristHeight("walking", 2)).toBeCloseTo(shield.guard.wrist[1], 6);
    expect(shieldWristHeight("standing", 1 / 60)).toBeLessThan(shield.guard.wrist[1]);
    expect(shieldWristHeight("standing", 2)).toBeCloseTo(idle, 6);
    expect(shieldWristHeight("walking", Number.NaN)).toBeCloseTo(idle, 6);
    expect(shieldWristHeight("walking", 2)).toBeCloseTo(shield.guard.wrist[1], 6);
  });

  it("holds the guard for a while after an attack made standing, then relaxes; reset clears it", () => {
    const config = {
      ...createDefaultProceduralMeleeConfig("knight"),
      offhandId: "t1-knight-default-shield" as const,
      weaponId: "t1-knight-default-sword" as const,
    };
    const shield = resolveProceduralMeleeOffhand(config.offhandId).armPoses;
    if (!shield) throw new Error("The Knight's shield declares no arm states");
    const controller = new ProceduralMeleeController(config, false, 0);
    const root = new Group();
    const shieldWristHeight = (seconds: number) => controller.update(seconds, root, "standing").arms.left?.wrist[1];

    expect(controller.attack(new Vector3(0, 0, 1))).toBe(true);
    for (let step = 0; step < 120; step += 1) shieldWristHeight(1 / 60);
    expect(controller.getStats().phase).toBe("idle");
    expect(shieldWristHeight(1 / 60)).toBeCloseTo(shield.guard.wrist[1], 4);
    expect(shieldWristHeight(3)).toBeCloseTo(shield.idle[0].wrist[1], 6);
    controller.attack(new Vector3(0, 0, 1));
    for (let step = 0; step < 120; step += 1) shieldWristHeight(1 / 60);
    controller.reset();
    expect(shieldWristHeight(1 / 60)).toBeCloseTo(shield.idle[0].wrist[1], 6);
  });

  it("makes the weapon's attacks in turn, from the bearer's seed", () => {
    const config = {
      ...createDefaultProceduralMeleeConfig("knight"),
      offhandId: "t1-knight-default-shield" as const,
      weaponId: "t1-knight-default-sword" as const,
    };
    const variants = resolveProceduralMeleeAttackVariants(config.weaponId);
    const attacksOf = (seed: number) => {
      const controller = new ProceduralMeleeController(config, false, seed);
      const root = new Group();
      return variants.map(() => {
        controller.attack(new Vector3(0, 0, 1));
        const variant = controller.getStats().attackVariant;
        for (let step = 0; step < 120; step += 1) controller.update(1 / 60, root, "standing");
        return variant;
      });
    };

    expect(new Set(attacksOf(0))).toEqual(new Set(variants));
    expect(attacksOf(1)).toEqual([...attacksOf(0).slice(1), attacksOf(0)[0]]);
  });
});
