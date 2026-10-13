import { configManager } from "@bibliothecadao/eternum";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { afterEach, expect, it, vi } from "vitest";
import { getGuardStaminaSnapshot } from "./guard-stamina";

afterEach(() => vi.restoreAllMocks());

it("keeps the resolved Frontier guard cap through refill and display, while legacy guards retain their tier bonus", () => {
  vi.spyOn(configManager, "getTick").mockReturnValue(60);
  vi.spyOn(configManager, "getTroopStaminaRules").mockReturnValue({
    stamina_initial: 120,
    stamina_knight_max: 120,
    stamina_gain_per_tick: 20,
  } as ReturnType<typeof configManager.getTroopStaminaRules>);
  const guard = {
    category: TroopType.Knight,
    tier: TroopTier.T3,
    stamina: { amount: 100n, settled_at: 10, remainder: 0 },
  };
  expect(getGuardStaminaSnapshot({ ...guard, staminaMax: 120 }, 190)).toEqual({ current: 120, max: 120 });
  expect(getGuardStaminaSnapshot(guard, 190)).toEqual({ current: 160, max: 160 });
});
