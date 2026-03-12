import { Direction } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import {
  resolveCreateArmyEffectTargetHex,
  shouldClearPendingAttackEffect,
  shouldClearPendingCreateArmyEffect,
} from "./worldmap-pending-action-effect-policy";

describe("resolveCreateArmyEffectTargetHex", () => {
  it("resolves the adjacent hex for a valid direction", () => {
    const target = resolveCreateArmyEffectTargetHex({ col: 10, row: 10 }, Direction.EAST);
    expect(target).toEqual({ col: 11, row: 10 });
  });

  it("returns null when structure hex is missing", () => {
    const target = resolveCreateArmyEffectTargetHex(undefined, Direction.NORTH_EAST);
    expect(target).toBeNull();
  });
});

describe("shouldClearPendingCreateArmyEffect", () => {
  it("clears when a non-removed army update matches pending target tile", () => {
    const shouldClear = shouldClearPendingCreateArmyEffect({
      pendingTargetHex: { col: 11, row: 10 },
      updateHex: { col: 11, row: 10 },
      removed: false,
    });

    expect(shouldClear).toBe(true);
  });

  it("does not clear when update hex does not match pending target", () => {
    const shouldClear = shouldClearPendingCreateArmyEffect({
      pendingTargetHex: { col: 11, row: 10 },
      updateHex: { col: 11, row: 11 },
      removed: false,
    });

    expect(shouldClear).toBe(false);
  });

  it("does not clear for removed updates", () => {
    const shouldClear = shouldClearPendingCreateArmyEffect({
      pendingTargetHex: { col: 11, row: 10 },
      updateHex: { col: 11, row: 10 },
      removed: true,
    });

    expect(shouldClear).toBe(false);
  });
});

describe("shouldClearPendingAttackEffect", () => {
  it("clears when attacker matches and defender is unspecified", () => {
    const shouldClear = shouldClearPendingAttackEffect({
      pendingAttackerId: 5,
      battleAttackerId: 5,
      battleDefenderId: 99,
    });

    expect(shouldClear).toBe(true);
  });

  it("clears when attacker and defender both match", () => {
    const shouldClear = shouldClearPendingAttackEffect({
      pendingAttackerId: 5,
      pendingDefenderId: 7,
      battleAttackerId: 5,
      battleDefenderId: 7,
    });

    expect(shouldClear).toBe(true);
  });

  it("does not clear when defender is set and does not match", () => {
    const shouldClear = shouldClearPendingAttackEffect({
      pendingAttackerId: 5,
      pendingDefenderId: 7,
      battleAttackerId: 5,
      battleDefenderId: 8,
    });

    expect(shouldClear).toBe(false);
  });

  it("does not clear when attacker does not match", () => {
    const shouldClear = shouldClearPendingAttackEffect({
      pendingAttackerId: 5,
      pendingDefenderId: 7,
      battleAttackerId: 6,
      battleDefenderId: 7,
    });

    expect(shouldClear).toBe(false);
  });
});
