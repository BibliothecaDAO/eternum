import { Group } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { resolveProceduralCharacterPose } from "./procedural-character-pose";
import { resolveCharacterRig } from "./procedural-character-rig";
import { createCharacterRagdollDefinition } from "./jolt-character-ragdoll";
import { JOLT_RAGDOLL_GROUND_HALF_EXTENT } from "./jolt-ragdoll-world";

describe("character ragdoll world profile", () => {
  it("scales collider dimensions with the production coordinate space", () => {
    const config = createDefaultProceduralCharacterConfig();
    const rig = resolveCharacterRig(config);
    const pose = resolveProceduralCharacterPose(rig, config, 0);
    const coordinateSpace = new Group();
    coordinateSpace.scale.setScalar(0.5);
    coordinateSpace.updateWorldMatrix(true, false);

    const definition = createCharacterRagdollDefinition(rig, pose, config, coordinateSpace);

    expect(definition.parts.chest.halfExtents).toEqual(rig.parts.chest.halfExtents?.map((value) => value * 0.5));
    expect(definition.parts.forearmLeft.length).toBeCloseTo((rig.parts.forearmLeft.length ?? 0) * 0.5);
    expect(definition.parts.forearmLeft.radius).toBeCloseTo((rig.parts.forearmLeft.radius ?? 0) * 0.5);
  });

  it("covers the complete normalized world-map footprint", () => {
    expect(JOLT_RAGDOLL_GROUND_HALF_EXTENT).toBeGreaterThanOrEqual(1_000);
  });
});
