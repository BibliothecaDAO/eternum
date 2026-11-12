import { Color } from "three";
import { describe, expect, it } from "vitest";

import { GroundLights } from "./ground-lights";

const ember = { colour: new Color(1, 0.5, 0), reach: 2 };

describe("the ground's lights", () => {
  it("light the ground round them in their colour, brightest at the middle, nothing past their reach", () => {
    const lights = new GroundLights();
    lights.set("fire", 3, 5, ember);
    lights.follow(0, 0);

    const middle = lights.read(3, 5);
    const halfway = lights.read(4, 5);
    expect(middle.r).toBeGreaterThan(0.75);
    expect(middle.g).toBeCloseTo(middle.r / 2, 1);
    expect(middle.b).toBe(0);
    expect(halfway.r).toBeGreaterThan(0.1);
    expect(halfway.r).toBeLessThan(middle.r);
    expect(lights.read(5.5, 5).r).toBe(0);
  });

  it("add up where two lights meet, and go dark when a light is removed", () => {
    const lights = new GroundLights();
    lights.set("a", 0, 0, ember);
    lights.set("b", 1, 0, ember);
    lights.follow(0, 0);
    const both = lights.read(0.5, 0).r;
    lights.remove("b");
    lights.follow(0, 0);
    const one = lights.read(0.5, 0).r;

    expect(both).toBeGreaterThan(one * 1.5);
    lights.remove("a");
    lights.follow(0, 0);
    expect(lights.read(0.5, 0).r).toBe(0);
  });

  it("cover the ground round the camera and follow it", () => {
    const lights = new GroundLights();
    lights.set("far", 100, 0, ember);
    lights.follow(0, 0);
    expect(lights.read(100, 0).r).toBe(0);

    lights.follow(96, 0);
    expect(lights.read(100, 0).r).toBeGreaterThan(0.75);
  });
});
