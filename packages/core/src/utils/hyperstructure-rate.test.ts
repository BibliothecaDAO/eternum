import { describe, expect, it } from "vitest";
import { hyperstructureRate, hyperstructureRateUnit } from "./hyperstructure";

const grants = (hyperstructureScale: "flat" | "double" | "per-realm") => ({
  hyperstructurePerSecond: 1,
  hyperstructureScale,
});

describe("a Hyperstructure's one rate", () => {
  it("pays its holder the game's rate times the multiplier struck when it was taken", () => {
    expect(hyperstructureRate(grants("per-realm"), { taken: true, struckMultiplier: 3, realmsAround: 2 })).toEqual({
      pointsPerSecond: 3,
      taken: true,
    });
  });

  it("shows an untaken one at what taking it now would pay: the realms around it, two in a Duel, else one", () => {
    const untaken = { taken: false, struckMultiplier: 0, realmsAround: 2 };
    expect(hyperstructureRate(grants("per-realm"), untaken).pointsPerSecond).toBe(2);
    expect(hyperstructureRate(grants("flat"), untaken).pointsPerSecond).toBe(1);
    expect(hyperstructureRate({ hyperstructurePerSecond: 5, hyperstructureScale: "per-realm" }, untaken)).toEqual({
      pointsPerSecond: 10,
      taken: false,
    });
  });

  it("words the rate the same on every surface", () => {
    expect(hyperstructureRateUnit(true)).toBe("points/s");
    expect(hyperstructureRateUnit(false)).toBe("points/s once taken");
  });
});
