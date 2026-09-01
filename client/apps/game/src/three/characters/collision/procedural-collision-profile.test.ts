import { describe, expect, it } from "vitest";

import { createProceduralCollisionBudget, createProceduralCollisionProfile } from "./procedural-collision-profile";

describe("procedural collision profiles", () => {
  it("gives the dragon a bounded multi-proxy body for mini simulations", () => {
    const profile = createProceduralCollisionProfile("dragon", 0.5);

    expect(profile.mass).toBeGreaterThan(createProceduralCollisionProfile("knight").mass);
    expect(profile.proxies).toHaveLength(3);
    expect(profile.proxies.every(({ radius }) => radius > 0 && radius < 0.4)).toBe(true);
    expect(profile.maxVisualOffset).toBeCloseTo(0.1);
  });

  it("reserves enough neighboring bodies for the mixed 100-actor benchmark", () => {
    const budget = createProceduralCollisionBudget("benchmark");

    expect(budget.maxNeighborsPerBody).toBe(16);
    expect(budget.maxPairResolutions).toBe(2_048);
  });
});
