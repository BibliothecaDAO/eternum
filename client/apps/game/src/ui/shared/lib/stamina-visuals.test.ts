import { describe, expect, it } from "vitest";

import { isStaminaRecharging } from "./stamina-visuals";

describe("isStaminaRecharging", () => {
  it("treats partially filled stamina as recharging", () => {
    expect(isStaminaRecharging(40, 100)).toBe(true);
  });

  it("treats full stamina as stable", () => {
    expect(isStaminaRecharging(100, 100)).toBe(false);
  });

  it("guards invalid inputs", () => {
    expect(isStaminaRecharging(Number.NaN, 100)).toBe(false);
    expect(isStaminaRecharging(20, 0)).toBe(false);
  });
});
