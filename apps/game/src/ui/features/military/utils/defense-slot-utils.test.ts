import { GuardSlot } from "@bibliothecadao/types";
import { expect, it } from "vitest";

import { structureGuardSlots } from "./defense-slot-utils";

const structure = (troop_max_guard_count: number) => ({ base: { troop_max_guard_count } });

it("are as many as the chain set on the structure, slot 1 first, whatever its level", () => {
  expect(structureGuardSlots(structure(1))).toEqual([GuardSlot.Delta]);
  expect(structureGuardSlots(structure(4))).toEqual([
    GuardSlot.Delta,
    GuardSlot.Gamma,
    GuardSlot.Beta,
    GuardSlot.Alpha,
  ]);
});

it("are none for a structure not yet known, or one that holds no guards", () => {
  expect(structureGuardSlots(undefined)).toEqual([]);
  expect(structureGuardSlots(structure(0))).toEqual([]);
});
