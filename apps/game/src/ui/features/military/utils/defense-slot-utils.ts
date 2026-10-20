import { GUARD_SLOT_ORDER, type GuardSlot } from "@bibliothecadao/types";

/**
 * A structure's guard slots, in the order the HUD numbers them (slot 1 first): as many as the chain set on the
 * structure (`troop_max_guard_count`, from its level's preset as it levels up, or its kind's fixed count), the number
 * every guard order is checked against. None while the structure is unknown.
 */
export const structureGuardSlots = (
  structure: { base: { troop_max_guard_count: number | bigint } } | null | undefined,
): GuardSlot[] => (structure ? GUARD_SLOT_ORDER.slice(0, Number(structure.base.troop_max_guard_count)) : []);
