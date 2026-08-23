import { describe, expect, it } from "vitest";

import { createDefaultProceduralCharacterConfig } from "../procedural-character-config";
import { resolveProceduralCharacterPose } from "../procedural-character-pose";
import { resolveCharacterRig } from "../procedural-character-rig";
import { ProceduralContactReactionController } from "./procedural-contact-reaction";

describe("procedural contact reaction", () => {
  it("creates an immediate bounded directional reaction and returns to idle", () => {
    const controller = new ProceduralContactReactionController();
    controller.trigger({
      localDirectionX: 3,
      localDirectionY: 0,
      localDirectionZ: 4,
      source: "arrow",
      strength: 8,
    });

    const started = controller.update(0.055)!;
    expect(started.localDirectionX).toBeCloseTo(0.6);
    expect(started.localDirectionZ).toBeCloseTo(0.8);
    expect(started.weight).toBeGreaterThan(0.5);
    expect(started.weight).toBeLessThanOrEqual(1);
    for (let step = 0; step < 5; step += 1) controller.update(0.1);
    expect(controller.getPose()).toBeUndefined();
  });

  it("does not let a weak scrape replace a strong active impact", () => {
    const controller = new ProceduralContactReactionController();
    controller.trigger({ localDirectionX: 1, localDirectionY: 0, localDirectionZ: 0, source: "arrow", strength: 8 });
    controller.trigger({
      localDirectionX: -1,
      localDirectionY: 0,
      localDirectionZ: 0,
      source: "body-contact",
      strength: 0.02,
    });

    expect(controller.update(0.02)?.localDirectionX).toBe(1);
  });

  it("adds readable pelvis and torso response without producing non-finite pose values", () => {
    const config = createDefaultProceduralCharacterConfig();
    const rig = resolveCharacterRig(config);
    const base = resolveProceduralCharacterPose(rig, config, 0);
    const reacted = resolveProceduralCharacterPose(rig, config, 0, undefined, undefined, undefined, {
      localDirectionX: 1,
      localDirectionY: 0,
      localDirectionZ: 0,
      source: "body-contact",
      weight: 1,
    });

    expect(reacted.parts.pelvis.position[0]).toBeGreaterThan(base.parts.pelvis.position[0]);
    expect(reacted.parts.chest.quaternion).not.toEqual(base.parts.chest.quaternion);
    expect(
      Object.values(reacted.parts).every(({ position, quaternion }) =>
        [...position, ...quaternion].every(Number.isFinite),
      ),
    ).toBe(true);
  });
});
