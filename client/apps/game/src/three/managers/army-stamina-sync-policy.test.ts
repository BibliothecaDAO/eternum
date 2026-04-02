// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  buildTrackedArmyTileSync,
  shouldAcceptTrackedArmyStaminaSnapshot,
  type TrackedArmyBattleState,
  type TrackedArmyStaminaSnapshot,
} from "./army-stamina-sync-policy";

const existingSnapshot = (overrides?: Partial<TrackedArmyStaminaSnapshot>): TrackedArmyStaminaSnapshot => ({
  troopCount: 10,
  currentStamina: 40,
  maxStamina: 100,
  onChainStamina: {
    amount: 30n,
    updatedTick: 12,
  },
  ...overrides,
});

const incomingBattleState = (overrides?: Partial<TrackedArmyBattleState>): TrackedArmyBattleState => ({
  battleCooldownEnd: 75,
  battleTimerLeft: 12,
  attackedFromDegrees: 90,
  attackedTowardDegrees: 270,
  ...overrides,
});

describe("shouldAcceptTrackedArmyStaminaSnapshot", () => {
  it("accepts a newer incoming stamina snapshot", () => {
    expect(
      shouldAcceptTrackedArmyStaminaSnapshot({
        existing: existingSnapshot(),
        incoming: existingSnapshot({
          troopCount: 8,
          currentStamina: 24,
          onChainStamina: {
            amount: 20n,
            updatedTick: 13,
          },
        }),
      }),
    ).toBe(true);
  });

  it("rejects an older incoming stamina snapshot", () => {
    expect(
      shouldAcceptTrackedArmyStaminaSnapshot({
        existing: existingSnapshot(),
        incoming: existingSnapshot({
          troopCount: 8,
          currentStamina: 24,
          onChainStamina: {
            amount: 20n,
            updatedTick: 11,
          },
        }),
      }),
    ).toBe(false);
  });

  it("accepts an equal-tick snapshot when troop count changed", () => {
    expect(
      shouldAcceptTrackedArmyStaminaSnapshot({
        existing: existingSnapshot(),
        incoming: existingSnapshot({
          troopCount: 8,
        }),
      }),
    ).toBe(true);
  });

  it("accepts an equal-tick snapshot when battle state changed", () => {
    expect(
      shouldAcceptTrackedArmyStaminaSnapshot({
        existing: existingSnapshot({
          battleCooldownEnd: 75,
          battleTimerLeft: 12,
        }),
        incoming: existingSnapshot({
          battleCooldownEnd: 90,
          battleTimerLeft: 30,
        }),
      }),
    ).toBe(true);
  });
});

describe("buildTrackedArmyTileSync", () => {
  it("uses incoming stamina values when the tile update is newer", () => {
    const sync = buildTrackedArmyTileSync({
      existing: existingSnapshot(),
      incoming: {
        troopCount: 9,
        currentStamina: 19,
        maxStamina: 120,
        onChainStamina: {
          amount: 19n,
          updatedTick: 13,
        },
        battleState: incomingBattleState(),
        owningStructureId: 77,
      },
      currentArmiesTick: 20,
      recomputeCurrentStamina: () => 999,
    });

    expect(sync).toEqual({
      troopCount: 9,
      currentStamina: 19,
      maxStamina: 120,
      onChainStamina: {
        amount: 19n,
        updatedTick: 13,
      },
      battleCooldownEnd: 75,
      battleTimerLeft: 12,
      attackedFromDegrees: 90,
      attackedTowardDegrees: 270,
      owningStructureId: 77,
    });
  });

  it("recomputes current stamina when a newer on-chain snapshot arrives without a current stamina value", () => {
    const sync = buildTrackedArmyTileSync({
      existing: existingSnapshot(),
      incoming: {
        troopCount: 9,
        maxStamina: 120,
        onChainStamina: {
          amount: 19n,
          updatedTick: 13,
        },
        battleState: incomingBattleState(),
      },
      currentArmiesTick: 20,
      recomputeCurrentStamina: ({ currentArmiesTick, troopCount, onChainStamina }) =>
        currentArmiesTick + troopCount + Number(onChainStamina.amount),
    });

    expect(sync?.currentStamina).toBe(48);
  });

  it("keeps the existing stamina snapshot when the incoming tile update is older", () => {
    const sync = buildTrackedArmyTileSync({
      existing: existingSnapshot({
        troopCount: 11,
        currentStamina: 52,
        maxStamina: 100,
        onChainStamina: {
          amount: 31n,
          updatedTick: 12,
        },
      }),
      incoming: {
        troopCount: 8,
        currentStamina: 10,
        maxStamina: 80,
        onChainStamina: {
          amount: 10n,
          updatedTick: 11,
        },
        battleState: incomingBattleState(),
      },
      currentArmiesTick: 20,
      recomputeCurrentStamina: () => 999,
    });

    expect(sync).toEqual({
      troopCount: 11,
      currentStamina: 52,
      maxStamina: 100,
      onChainStamina: {
        amount: 31n,
        updatedTick: 12,
      },
      battleCooldownEnd: 75,
      battleTimerLeft: 12,
      attackedFromDegrees: 90,
      attackedTowardDegrees: 270,
      owningStructureId: undefined,
    });
  });
});
