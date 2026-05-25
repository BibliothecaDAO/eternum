import { afterEach, describe, expect, it, vi } from "vitest";

import { getGuardStaminaSnapshot } from "./guard-stamina";

const { getMaxStaminaMock, getStaminaMock } = vi.hoisted(() => ({
  getMaxStaminaMock: vi.fn(),
  getStaminaMock: vi.fn(),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  StaminaManager: {
    getMaxStamina: getMaxStaminaMock,
    getStamina: getStaminaMock,
  },
}));

describe("getGuardStaminaSnapshot", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("recomputes stamina from the current tick even when boost fields are missing", () => {
    getMaxStaminaMock.mockReturnValue(120);
    getStaminaMock.mockReturnValue({
      amount: 60n,
      updated_tick: 5n,
    });

    const snapshot = getGuardStaminaSnapshot(
      {
        category: 1,
        tier: 1,
        stamina: {
          amount: 40n,
          updated_tick: 3n,
        },
      },
      5,
    );

    expect(snapshot).toEqual({
      current: 60,
      max: 120,
    });
  });
});
