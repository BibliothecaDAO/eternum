// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const { getStaminaMock } = vi.hoisted(() => ({
  getStaminaMock: vi.fn(),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  StaminaManager: {
    getStamina: getStaminaMock,
  },
}));

vi.mock("@bibliothecadao/types", () => ({
  TroopType: {
    Knight: "Knight",
    Crossbowman: "Crossbowman",
  },
  TroopTier: {
    T1: "T1",
    T2: "T2",
  },
}));

import {
  type ArmyStaminaInput,
  projectArmyCurrentStamina,
  resolveArmyStaminaBoosts,
  ZERO_ARMY_STAMINA_BOOSTS,
} from "./army-stamina";

describe("army-stamina", () => {
  afterEach(() => {
    getStaminaMock.mockReset();
  });

  it("passes active boosts through to stamina projection", () => {
    getStaminaMock.mockReturnValue({ amount: 77n, updated_tick: 4n });

    const result = projectArmyCurrentStamina({
      troopCategory: "Knight" as ArmyStaminaInput["troopCategory"],
      troopTier: "T2" as ArmyStaminaInput["troopTier"],
      troopCount: 100,
      onChainStamina: { amount: 50n, updatedTick: 10 },
      currentArmiesTick: 123,
      boosts: {
        incr_stamina_regen_percent_num: 2_500,
        incr_stamina_regen_tick_count: 4,
      },
    });

    expect(result).toBe(77);
    expect(getStaminaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        boosts: expect.objectContaining({
          incr_stamina_regen_percent_num: 2_500,
          incr_stamina_regen_tick_count: 4,
        }),
      }),
      123,
    );
  });

  it("falls back to zero boosts when none are available", () => {
    getStaminaMock.mockReturnValue({ amount: 33n, updated_tick: 8n });

    projectArmyCurrentStamina({
      troopCategory: "Crossbowman" as ArmyStaminaInput["troopCategory"],
      troopTier: "T1" as ArmyStaminaInput["troopTier"],
      troopCount: 25,
      onChainStamina: { amount: 20n, updatedTick: 2 },
      currentArmiesTick: 18,
    });

    expect(getStaminaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        boosts: ZERO_ARMY_STAMINA_BOOSTS,
      }),
      18,
    );
  });

  it("normalizes missing boost fields to zero", () => {
    expect(
      resolveArmyStaminaBoosts({
        incr_stamina_regen_percent_num: 1500,
      }),
    ).toEqual({
      ...ZERO_ARMY_STAMINA_BOOSTS,
      incr_stamina_regen_percent_num: 1500,
    });
  });
});
