import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import { intersectSweptSphere, resolveBallisticLaunchVelocity, stepArrowBallistics } from "./arrow-ballistics";

describe("arrow ballistics", () => {
  it("reaches a static target at the configured flight time", () => {
    const origin = new Vector3(0, 1.5, 0);
    const target = new Vector3(0, 1.2, 6);
    const gravity = new Vector3(0, -8, 0);
    const velocity = resolveBallisticLaunchVelocity(origin, target, new Vector3(), gravity, 0.75);
    const state = { position: origin.clone(), velocity };

    for (let step = 0; step < 90; step += 1) stepArrowBallistics(state, gravity, 1 / 120);

    expect(state.position.distanceTo(target)).toBeLessThan(1e-9);
  });

  it("detects a thin target crossed entirely within one frame", () => {
    const hit = intersectSweptSphere(new Vector3(0, 1, 0), new Vector3(0, 1, 10), new Vector3(0, 1, 5), 0.02);

    expect(hit?.fraction).toBeCloseTo(0.498);
    expect(hit?.point.z).toBeCloseTo(4.98);
  });

  it("does not report a swept hit behind the projectile", () => {
    expect(intersectSweptSphere(new Vector3(0, 0, 1), new Vector3(0, 0, 2), new Vector3(0, 0, 0), 0.1)).toBeUndefined();
  });
});
