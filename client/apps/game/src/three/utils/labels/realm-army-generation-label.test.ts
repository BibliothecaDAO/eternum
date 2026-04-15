import { describe, expect, it, vi } from "vitest";

vi.mock("../../scenes/hexagon-scene", () => ({
  CameraView: {
    Close: 1,
    Medium: 2,
    Far: 3,
  },
}));

const { formatArmyProductionPerTick } = await import("./realm-army-generation-label");

describe("formatArmyProductionPerTick", () => {
  it("formats whole troop output values from raw precision-scaled rates", () => {
    expect(formatArmyProductionPerTick(5_000_000_000n)).toBe("5");
  });

  it("formats fractional troop output values and trims trailing zeroes", () => {
    expect(formatArmyProductionPerTick(500_000_000n)).toBe("0.5");
    expect(formatArmyProductionPerTick(1_250_000_000n)).toBe("1.25");
    expect(formatArmyProductionPerTick(1_200_000_000n)).toBe("1.2");
  });

  it("formats very small non-zero rates with two decimal places", () => {
    expect(formatArmyProductionPerTick(10_000_000n)).toBe("0.01");
  });
});
