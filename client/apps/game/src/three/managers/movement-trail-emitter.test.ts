import { describe, expect, it } from "vitest";
import { resolveTrailConfig, TrailParticle, updateTrailParticle } from "./movement-trail-emitter";

describe("resolveTrailConfig", () => {
  it("returns dust config for land biomes", () => {
    const config = resolveTrailConfig("Grassland");
    expect(config.type).toBe("dust");
    expect(config.color).toBeDefined();
    expect(config.lifetime).toBeGreaterThan(0);
  });

  it("returns wake config for ocean biomes", () => {
    const config = resolveTrailConfig("Ocean");
    expect(config.type).toBe("wake");
  });

  it("returns wake config for deep ocean", () => {
    const config = resolveTrailConfig("DeepOcean");
    expect(config.type).toBe("wake");
  });

  it("returns dust config for desert biomes", () => {
    const config = resolveTrailConfig("SubtropicalDesert");
    expect(config.type).toBe("dust");
  });
});

describe("updateTrailParticle", () => {
  it("reduces remaining lifetime", () => {
    const particle: TrailParticle = {
      age: 0,
      lifetime: 0.6,
      opacity: 1,
      active: true,
    };
    const updated = updateTrailParticle(particle, 0.1);
    expect(updated.age).toBeCloseTo(0.1);
    expect(updated.active).toBe(true);
  });

  it("deactivates particle when lifetime exceeded", () => {
    const particle: TrailParticle = {
      age: 0.55,
      lifetime: 0.6,
      opacity: 1,
      active: true,
    };
    const updated = updateTrailParticle(particle, 0.1);
    expect(updated.active).toBe(false);
  });

  it("fades opacity as particle ages", () => {
    const particle: TrailParticle = {
      age: 0,
      lifetime: 1.0,
      opacity: 1,
      active: true,
    };
    const halfLife = updateTrailParticle(particle, 0.5);
    expect(halfLife.opacity).toBeLessThan(1);
    expect(halfLife.opacity).toBeGreaterThan(0);
  });
});
