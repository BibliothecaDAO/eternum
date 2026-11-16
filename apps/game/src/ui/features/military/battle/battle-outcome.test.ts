// @vitest-environment node
import { expect, it } from "vitest";
import { attackerSide, defenderSide, survivalOf } from "./battle-outcome";

const outcome = {
  attackerDamage: 80,
  defenderDamage: 120,
  attackerStamina: 90,
  defenderStamina: 100,
  attackerCooldownEnd: 100,
  defenderCooldownEnd: 100,
};
it("caps losses at each side's troops and reports exact survival", () => {
  expect(attackerSide(100, outcome)).toEqual({ losses: 100, remaining: 0 });
  expect(defenderSide(100, outcome)).toEqual({ losses: 80, remaining: 20 });
  expect(survivalOf(attackerSide(100, outcome))).toBe("Eliminated");
  expect(survivalOf(defenderSide(100, outcome))).toBe("Survives");
});
