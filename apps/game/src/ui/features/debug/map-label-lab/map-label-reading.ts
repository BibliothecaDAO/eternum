import type { MapLabelEntity, MapLabelTroops } from "@/three/debug/map-label-lab-fixture";

const LOCAL_RANGE = 2 ** 32;

/** A thing's short id, read off its entity id: its home namespace and serial ("19·21"); its kind is its painting. */
export const homeCode = (entity: MapLabelEntity): string =>
  `${Math.floor(entity.entityId / LOCAL_RANGE)}·${entity.entityId % LOCAL_RANGE}`;

/**
 * A guard at rest, one number (round 3): a single slot as that slot (its troop type, tier and count); several as the
 * total count only, their slots left to the opened plate; none, open.
 */
export const restingGuard = (
  guards: readonly MapLabelTroops[],
): { kind: "slot"; slot: MapLabelTroops } | { kind: "total"; total: number } | { kind: "open" } => {
  if (guards.length === 0) return { kind: "open" };
  if (guards.length === 1) return { kind: "slot", slot: guards[0] };
  return { kind: "total", total: guards.reduce((sum, slot) => sum + slot.count, 0) };
};

/**
 * Guard slots in the order an attacker meets them: the contract attacks the highest occupied slot first, slot zero last
 * (`GuardState::next`, contracts/l3/world-native/src/logic/guards.cairo). Slots are listed by slot index; empty ones are
 * skipped.
 */
export const attackOrder = (guards: readonly MapLabelTroops[]): MapLabelTroops[] =>
  [...guards].reverse().filter((slot) => slot.count > 0);

export const formatCount = (count: number) => count.toLocaleString("en-US");
