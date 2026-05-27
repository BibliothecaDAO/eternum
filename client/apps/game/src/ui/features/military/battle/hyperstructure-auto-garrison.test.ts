// @vitest-environment node

import { describe, expect, it } from "vitest";
import { GuardSlot, StructureType } from "@bibliothecadao/types";
import {
  resolveAutoGarrisonPlan,
  resolveAutoGarrisonResources,
  resolveLiveAutoGarrisonCount,
} from "./hyperstructure-auto-garrison";
import { TargetType } from "./types";

const makeTarget = (overrides: Partial<Parameters<typeof resolveAutoGarrisonPlan>[0]["target"]> = {}) => ({
  id: 200,
  targetType: TargetType.Structure,
  structureCategory: StructureType.Hyperstructure,
  info: [],
  hex: { x: 5, y: 6 },
  addressOwner: 0n,
  guardSlotLimit: 3,
  ...overrides,
});

describe("resolveAutoGarrisonPlan", () => {
  it("uses an atomic multicall when the targeted hyperstructure has no active guards", () => {
    expect(
      resolveAutoGarrisonPlan({
        attackerType: "army",
        target: makeTarget(),
        attackerTroopCount: 123_000,
        projectedAttackerTroopCount: 123_000,
      }),
    ).toEqual({
      mode: "atomic",
      toGuardSlot: GuardSlot.Delta,
      count: 123_000,
    });
  });

  it("uses post-confirmation garrisoning when exactly one guard remains", () => {
    expect(
      resolveAutoGarrisonPlan({
        attackerType: "army",
        target: makeTarget({ info: [{ count: 100n } as never] }),
        attackerTroopCount: 123_000,
        projectedAttackerTroopCount: 45_000,
      }),
    ).toEqual({
      mode: "post-confirmation",
      toGuardSlot: GuardSlot.Delta,
      count: 45_000,
    });
  });

  it("does not auto-garrison when more than one guard remains", () => {
    expect(
      resolveAutoGarrisonPlan({
        attackerType: "army",
        target: makeTarget({ info: [{ count: 100n } as never, { count: 200n } as never] }),
        attackerTroopCount: 123_000,
        projectedAttackerTroopCount: 45_000,
      }),
    ).toEqual({ mode: "none" });
  });

  it("does not auto-garrison non-hyperstructure or structure attacks", () => {
    expect(
      resolveAutoGarrisonPlan({
        attackerType: "army",
        target: makeTarget({ structureCategory: StructureType.Realm }),
        attackerTroopCount: 123_000,
        projectedAttackerTroopCount: 45_000,
      }),
    ).toEqual({ mode: "none" });

    expect(
      resolveAutoGarrisonPlan({
        attackerType: "structure",
        target: makeTarget(),
        attackerTroopCount: 123_000,
        projectedAttackerTroopCount: 45_000,
      }),
    ).toEqual({ mode: "none" });
  });

  it("uses the first functional hyperstructure guard slot", () => {
    expect(
      resolveAutoGarrisonPlan({
        attackerType: "army",
        target: makeTarget({ guardSlotLimit: 1 }),
        attackerTroopCount: 123_000,
        projectedAttackerTroopCount: 123_000,
      }),
    ).toMatchObject({ toGuardSlot: GuardSlot.Delta });
  });
});

describe("resolveLiveAutoGarrisonCount", () => {
  it("uses the full surviving live explorer troop count", () => {
    expect(resolveLiveAutoGarrisonCount({ troops: { count: 77_000n } })).toBe(77_000);
  });
});

describe("resolveAutoGarrisonResources", () => {
  it("filters zero-balance resources before preserving explorer cargo", () => {
    const resources = resolveAutoGarrisonResources({
      resourceIds: [1, 2, 3],
      readBalance: (resourceId) => (resourceId === 2 ? 50 : 0),
    });

    expect(resources).toEqual([{ resourceId: 2, amount: 50 }]);
  });
});
