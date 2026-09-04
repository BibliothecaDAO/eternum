import { Group } from "three";
import { describe, expect, it } from "vitest";

import { resolveProceduralHorsePoseDiagnostics } from "./procedural-horse-diagnostics";
import type { HorseLegPose, ProceduralHorsePose } from "./procedural-horse-pose";

describe("procedural horse pose diagnostics", () => {
  it("projects named horse contacts into world space and reports inverted bends", () => {
    const root = new Group();
    root.position.set(2, 0, 3);
    const pose = createHorsePose();
    const diagnostics = resolveProceduralHorsePoseDiagnostics(pose, root);

    expect(diagnostics.headWorld).toEqual([2, 2, 4]);
    expect(diagnostics.stanceHoofCount).toBe(2);
    expect(diagnostics.legs.frontLeft.jointAnglesDegrees).toHaveLength(2);
    expect(diagnostics.legs.frontLeft.hoofWorld).toEqual([2.4, 0, 3.7]);
    expect(diagnostics.issues).toEqual(["hindRight-bend-inverted"]);
  });
});

function createHorsePose(): ProceduralHorsePose {
  return {
    bodyRotation: [0, 0, 0, 1],
    gait: "walk",
    headPosition: [0, 2, 1],
    legs: {
      frontLeft: createLeg(0.4, 0.7, "stance"),
      frontRight: createLeg(-0.4, 0.7, "swing"),
      hindLeft: createLeg(0.4, -0.7, "stance"),
      hindRight: createLeg(-0.4, -0.7, "swing", -0.1),
    },
    neckRotations: [],
    phase: 0.25,
    rootOffset: [0, 0, 0],
    saddlePosition: [0, 1.5, 0],
    saddleRotation: [0, 0, 0, 1],
    segmentRotations: {} as ProceduralHorsePose["segmentRotations"],
    tailRotations: [],
  };
}

function createLeg(x: number, z: number, contact: HorseLegPose["cycle"]["contact"], bendAlignment = 0.5): HorseLegPose {
  return {
    bendAlignment,
    cycle: { contact, progress: 0.5 },
    hoofTarget: [x, 0, z],
    joints: [
      [x, 1.4, z],
      [x, 0.9, z + 0.2],
      [x, 0.3, z],
    ],
  };
}
