import { describe, expect, it } from "vitest";

import {
  createWorldFxGymFixture,
  resolveWorldFxGymCount,
  resolveWorldFxGymScenario,
  resolveWorldFxGymSeed,
} from "./world-fx-gym-fixture";

describe("world FX gym fixture", () => {
  it("builds deterministic flame and impact layouts", () => {
    const first = createWorldFxGymFixture({ count: 10, scenario: "mixed", seed: 42 });
    const second = createWorldFxGymFixture({ count: 10, scenario: "mixed", seed: 42 });

    expect(first.flameEmitters).toHaveLength(10);
    expect(first.impactCues).toHaveLength(10);
    expect(first.flameEmitters).toEqual(second.flameEmitters);
    expect(first.impactCues).toEqual(second.impactCues);
    expect(first.positions.reduce((sum, position) => sum + position.x, 0)).toBeCloseTo(0);
  });

  it("keeps scenario composition explicit", () => {
    expect(createWorldFxGymFixture({ count: 1, scenario: "flame", seed: 1 }).impactCues).toHaveLength(0);
    expect(createWorldFxGymFixture({ count: 1, scenario: "impact", seed: 1 }).flameEmitters).toHaveLength(0);
  });

  it("normalizes route inputs", () => {
    expect(resolveWorldFxGymCount("50")).toBe(50);
    expect(resolveWorldFxGymCount("17")).toBe(10);
    expect(resolveWorldFxGymScenario("flame")).toBe("flame");
    expect(resolveWorldFxGymScenario("unknown")).toBe("mixed");
    expect(resolveWorldFxGymSeed("-1")).toBe(4_294_967_295);
    expect(resolveWorldFxGymSeed("bad")).toBe(20_260_902);
  });
});
