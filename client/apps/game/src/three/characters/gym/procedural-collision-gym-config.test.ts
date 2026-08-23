import { describe, expect, it } from "vitest";

import {
  applyProceduralCollisionGymConfigPatch,
  createDefaultProceduralCollisionGymConfig,
  resolveCollisionGymActorCount,
} from "./procedural-collision-gym-config";

describe("procedural collision gym config", () => {
  it("normalizes live controls and keeps pair scenarios minimal", () => {
    const config = applyProceduralCollisionGymConfigPatch(createDefaultProceduralCollisionGymConfig(), {
      actorCount: 500,
      enabled: true,
      scenario: "head-on",
      seed: -5,
      speed: Number.POSITIVE_INFINITY,
    });

    expect(config).toMatchObject({ actorCount: 100, enabled: true, seed: 0, speed: 0.1 });
    expect(resolveCollisionGymActorCount(config)).toBe(2);
  });

  it("uses the configured population for crossflow and crowd stress", () => {
    const base = createDefaultProceduralCollisionGymConfig();
    expect(resolveCollisionGymActorCount({ ...base, actorCount: 42, scenario: "crossflow" })).toBe(42);
    expect(resolveCollisionGymActorCount({ ...base, actorCount: 100, scenario: "crowd" })).toBe(100);
  });
});
