import { Quaternion } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { resolveProceduralCharacterPose } from "./procedural-character-pose";
import { ProceduralCharacterPoseFilter } from "./procedural-character-pose-filter";
import { resolveCharacterRig } from "./procedural-character-rig";

describe("procedural character pose filter", () => {
  it("lags upper-body targets while converging consistently across frame rates", () => {
    const config = createDefaultProceduralCharacterConfig();
    const rig = resolveCharacterRig(config);
    const source = resolveProceduralCharacterPose(rig, config, 0);
    const target = resolveProceduralCharacterPose(rig, config, 0.37);
    const filter30 = new ProceduralCharacterPoseFilter();
    const filter60 = new ProceduralCharacterPoseFilter();
    filter30.apply(source, 0, config.secondaryMotion);
    filter60.apply(source, 0, config.secondaryMotion);

    const firstFrame = filter60.apply(target, 1 / 60, config.secondaryMotion);
    expect(quaternionAngle(firstFrame.parts.chest.quaternion, target.parts.chest.quaternion)).toBeGreaterThan(0);

    let pose30 = source;
    let pose60 = source;
    for (let index = 0; index < 30; index += 1) pose30 = filter30.apply(target, 1 / 30, config.secondaryMotion);
    for (let index = 0; index < 60; index += 1) pose60 = filter60.apply(target, 1 / 60, config.secondaryMotion);
    expect(quaternionAngle(pose30.parts.chest.quaternion, pose60.parts.chest.quaternion)).toBeLessThan(1e-4);
  });
});

function quaternionAngle(left: readonly number[], right: readonly number[]): number {
  return new Quaternion(...(left as [number, number, number, number])).angleTo(
    new Quaternion(...(right as [number, number, number, number])),
  );
}
