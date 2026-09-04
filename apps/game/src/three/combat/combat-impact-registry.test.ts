import { describe, expect, it } from "vitest";

import type { ProceduralUnitImpact } from "../characters/collision/procedural-impact";
import { CombatImpactRegistry } from "./combat-impact-registry";

describe("combat impact registry", () => {
  it("stores and consumes one presentation impact for a target", () => {
    const registry = new CombatImpactRegistry();
    registry.record({ authority: "provisional", impact: impact("arrow:1"), nowSeconds: 2, targetEntityId: 42 });

    expect(registry.consume(42, 3)).toMatchObject({ impactId: "arrow:1", targetEntityId: 42 });
    expect(registry.consume(42, 3)).toBeUndefined();
    expect(registry.getStats()).toMatchObject({ activeCount: 0, consumedCount: 1, recordedCount: 1 });
  });

  it("replaces an older impact with the latest target reaction", () => {
    const registry = new CombatImpactRegistry();
    registry.record({ authority: "provisional", impact: impact("arrow:1"), nowSeconds: 1, targetEntityId: 42 });
    registry.record({ authority: "indexed-replay", impact: impact("arrow:2"), nowSeconds: 2, targetEntityId: 42 });

    expect(registry.consume(42, 3)).toMatchObject({ authority: "indexed-replay", impactId: "arrow:2" });
  });

  it("expires stale impacts at consumption", () => {
    const registry = new CombatImpactRegistry(2);
    registry.record({ authority: "provisional", impact: impact("old"), nowSeconds: 1, targetEntityId: 7 });

    expect(registry.consume(7, 3.01)).toBeUndefined();
    expect(registry.getStats()).toMatchObject({ activeCount: 0, expiredCount: 1 });
  });

  it("prunes every expired target without affecting live records", () => {
    const registry = new CombatImpactRegistry(2);
    registry.record({ authority: "provisional", impact: impact("old"), nowSeconds: 1, targetEntityId: 7 });
    registry.record({ authority: "provisional", impact: impact("live"), nowSeconds: 3, targetEntityId: 8 });
    registry.prune(3.1);

    expect(registry.consume(7, 3.1)).toBeUndefined();
    expect(registry.consume(8, 3.1)?.impactId).toBe("live");
  });

  it("normalizes unsafe direction, position, velocity, and strength values", () => {
    const registry = new CombatImpactRegistry();
    registry.record({
      authority: "debug",
      impact: {
        ...impact("unsafe"),
        directionX: Number.NaN,
        directionY: 0,
        directionZ: 0,
        inheritedVelocityX: Number.POSITIVE_INFINITY,
        pointY: Number.NaN,
        strength: 500,
      },
      nowSeconds: 0,
      targetEntityId: 1,
    });

    expect(registry.consume(1, 0)).toMatchObject({
      directionX: 0,
      directionY: 0,
      directionZ: 1,
      inheritedVelocityX: 0,
      pointY: 0,
      strength: 40,
    });
  });

  it("clears pending and diagnostic state on reset", () => {
    const registry = new CombatImpactRegistry();
    registry.record({ authority: "debug", impact: impact("one"), nowSeconds: 0, targetEntityId: 1 });
    registry.reset();

    expect(registry.consume(1, 0)).toBeUndefined();
    expect(registry.getStats()).toEqual({ activeCount: 0, consumedCount: 0, expiredCount: 0, recordedCount: 0 });
  });
});

function impact(impactId: string): ProceduralUnitImpact {
  return {
    directionX: 3,
    directionY: 0,
    directionZ: 4,
    impactId,
    inheritedVelocityX: 0,
    inheritedVelocityY: 0,
    inheritedVelocityZ: 0,
    pointX: 1,
    pointY: 2,
    pointZ: 3,
    source: "arrow",
    strength: 8,
    target: "unit",
  };
}
