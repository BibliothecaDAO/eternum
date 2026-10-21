import { describe, expect, it } from "vitest";

import { cameraPosition, pathDuration, poseAt, poseFromCamera, type StudioPose } from "./camera-path";

const start: StudioPose = { target: [0, 0, 0], distance: 20, tilt: 50, turn: 0, fov: 38 };

describe("a studio camera path", () => {
  it("holds its first key before it starts and its last after it ends", () => {
    const path = {
      keys: [
        { t: 1, distance: 10 },
        { t: 3, distance: 5, turn: 90 },
      ],
    };
    expect(poseAt(path, 0, start)).toEqual({ ...start, distance: 10 });
    expect(poseAt(path, 9, start)).toEqual({ ...start, distance: 5, turn: 90 });
  });

  it("eases between keys, slow at both ends, and keeps what a key leaves out", () => {
    const path = { keys: [{ t: 0 }, { t: 4, turn: 360, tilt: 70 }] };
    expect(poseAt(path, 2, start)).toMatchObject({ turn: 180, tilt: 60, distance: 20, fov: 38 });
    expect(poseAt(path, 0.4, start).turn).toBeLessThan(36);
  });

  it("moves at a constant rate on a linear key, a full orbit with no wrap", () => {
    const path = {
      keys: [
        { t: 0, turn: 0 },
        { t: 8, turn: 360, ease: "linear" as const },
      ],
    };
    expect([1, 2, 6].map((t) => poseAt(path, t, start).turn)).toEqual([45, 90, 270]);
  });

  it("pushes in by the same ratio each second", () => {
    const path = {
      keys: [
        { t: 0, distance: 40 },
        { t: 2, distance: 10, ease: "linear" as const },
      ],
    };
    expect(poseAt(path, 1, start).distance).toBeCloseTo(20);
  });

  it("lasts until its last key or cue", () => {
    expect(pathDuration({ keys: [{ t: 0 }, { t: 6 }], cues: [{ at: 7.5, trigger: "attack" }] })).toBe(7.5);
  });
});

describe("a studio pose", () => {
  it("places the camera above, behind and around its target", () => {
    const [x, y, z] = cameraPosition({ ...start, target: [10, 1, 10], distance: 10, tilt: 0 });
    expect([x, y, z].map((value) => Number(value.toFixed(6)))).toEqual([10, 11, 10]);
    const south = cameraPosition({ ...start, distance: 10, tilt: 90, turn: 0 });
    expect(south[2]).toBeCloseTo(10);
    expect(south[1]).toBeGreaterThan(0);
  });

  it("is read back from the camera it places", () => {
    const pose: StudioPose = { target: [3, 0.5, -4], distance: 12, tilt: 63, turn: -120, fov: 25 };
    const read = poseFromCamera(cameraPosition(pose), pose.target, pose.fov);
    expect(read.distance).toBeCloseTo(12);
    expect(read.tilt).toBeCloseTo(63);
    expect(read.turn).toBeCloseTo(-120);
  });
});
