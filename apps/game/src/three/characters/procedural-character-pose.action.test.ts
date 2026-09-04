import { describe, expect, it } from "vitest";

import type { ProceduralMeleeUpperBodyPose } from "./melee/procedural-melee-pose";
import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { resolveProceduralCharacterPose } from "./procedural-character-pose";
import { resolveCharacterRig } from "./procedural-character-rig";

describe("procedural character action pose", () => {
  it("shifts melee weight through the pelvis while preserving planted ankles", () => {
    const config = createDefaultProceduralCharacterConfig();
    const rig = resolveCharacterRig(config);
    const idle = resolveProceduralCharacterPose(rig, config, 0);
    const contact = resolveProceduralCharacterPose(rig, config, 0, undefined, undefined, createMeleeContactPose());

    expect(contact.parts.pelvis.position[1]).toBeLessThan(idle.parts.pelvis.position[1]);
    expect(contact.parts.pelvis.position[2]).toBeGreaterThan(idle.parts.pelvis.position[2]);
    expectPointToEqual(resolveEndpoint(contact, "shinLeft"), resolveEndpoint(idle, "shinLeft"));
    expectPointToEqual(resolveEndpoint(contact, "shinRight"), resolveEndpoint(idle, "shinRight"));
  });
});

function createMeleeContactPose(): ProceduralMeleeUpperBodyPose {
  return {
    actionWeight: 1,
    aimPitchRadians: 0,
    aimYawRadians: 0,
    attackArcRadians: (118 * Math.PI) / 180,
    attackStyle: "slash",
    contactProgress: 0.5,
    followThrough: 0,
    kind: "melee",
    mounted: false,
    offhandId: "round-shield",
    reach: 1.45,
    stepThrough: 0.22,
    strikeProgress: 1,
    torsoWeight: 0.62,
    weaponId: "iron-longsword",
    windupProgress: 1,
  };
}

function expectPointToEqual(actual: readonly number[], expected: readonly number[]): void {
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 8));
}

function resolveEndpoint(
  pose: ReturnType<typeof resolveProceduralCharacterPose>,
  partId: "shinLeft" | "shinRight",
): readonly [number, number, number] {
  const part = pose.parts[partId];
  return [
    part.position[0] * 2 - part.jointAnchor[0],
    part.position[1] * 2 - part.jointAnchor[1],
    part.position[2] * 2 - part.jointAnchor[2],
  ];
}
