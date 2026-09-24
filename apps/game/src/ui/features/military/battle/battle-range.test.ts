// @vitest-environment node
import { describe, expect, it } from "vitest";
import { attackerSideRange, defenderSideRange, formatAcross, survivalOf } from "./battle-range";

const outcome = (attackerDamage: number, defenderDamage: number) => ({
  attackerDamage,
  defenderDamage,
  attackerRefundMultiplier: 0,
  defenderRefundMultiplier: 0,
});

describe("battle range", () => {
  const range = { worst: outcome(80, 120), best: outcome(120, 90) };

  it("reads each side's losses at the attacker's worst and best rolls, capped at its troops", () => {
    expect(attackerSideRange(100, range)).toEqual({
      worst: { losses: 100, remaining: 0 },
      best: { losses: 90, remaining: 10 },
    });
    expect(defenderSideRange(100, range)).toEqual({
      worst: { losses: 80, remaining: 20 },
      best: { losses: 100, remaining: 0 },
    });
  });

  it("settles survival only where the dice cannot change it", () => {
    expect(survivalOf(attackerSideRange(100, range))).toBe("May fall");
    expect(survivalOf(attackerSideRange(200, range))).toBe("Survives");
    expect(survivalOf(attackerSideRange(50, range))).toBe("Eliminated");
  });

  it("prints one number where the dice cannot move a value", () => {
    const whole = (value: number) => Math.round(value).toString();
    expect(formatAcross(90, 100, whole)).toBe("90–100");
    expect(formatAcross(100, 90, whole)).toBe("90–100");
    expect(formatAcross(90.2, 89.9, whole)).toBe("90");
  });
});
