import { describe, expect, it } from "vitest";

import {
  buildAttackStaminaRequirementLabel,
  buildAttackStaminaWarning,
  resolveAttackStaminaState,
} from "./attack-stamina-state";

describe("attack-stamina-state", () => {
  it("blocks undefended structure claims when stamina is below the requirement", () => {
    const state = resolveAttackStaminaState({
      attackerStamina: 0n,
      hasAttackerTroops: true,
      hasDefenders: false,
      requiredStamina: 50,
    });

    expect(state.actionLabel).toBe("Claim");
    expect(state.isBlocked).toBe(true);
    expect(buildAttackStaminaRequirementLabel(state)).toBe("Need 50 stamina to claim");
  });

  it("allows attacks when stamina meets the requirement", () => {
    const state = resolveAttackStaminaState({
      attackerStamina: 50n,
      hasAttackerTroops: true,
      hasDefenders: true,
      requiredStamina: 50,
    });

    expect(state.actionLabel).toBe("Attack");
    expect(state.isBlocked).toBe(false);
    expect(state.hasRequiredStamina).toBe(true);
  });

  it("builds action-specific stamina warnings", () => {
    const state = resolveAttackStaminaState({
      attackerStamina: 10n,
      hasAttackerTroops: true,
      hasDefenders: true,
      requiredStamina: 50,
    });

    expect(buildAttackStaminaWarning(state)).toBe("Insufficient stamina: 10 / 50 required to attack");
  });
});
