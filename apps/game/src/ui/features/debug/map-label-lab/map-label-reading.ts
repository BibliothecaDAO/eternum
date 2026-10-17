import type { MapLabelEntity, MapLabelTroops, MapLabelTroopType } from "@/three/debug/map-label-lab-fixture";

const LOCAL_RANGE = 2 ** 32;

const KIND_WORD: Record<MapLabelEntity["kind"], string> = {
  realm: "Realm",
  camp: "Camp",
  rift: "Rift",
  hyperstructure: "Hyperstructure",
  army: "Army",
};

/**
 * The owner's pick (round 2): a thing no player named is called by its kind and a short code read off its id, its home
 * namespace and serial ("Camp 19·21"); a realm keeps its own name.
 */
export const codeName = (entity: MapLabelEntity): string =>
  entity.kind === "realm"
    ? entity.name
    : `${KIND_WORD[entity.kind]} ${Math.floor(entity.entityId / LOCAL_RANGE)}·${entity.entityId % LOCAL_RANGE}`;

export const TROOP_WORD: Record<MapLabelTroopType, string> = {
  crossbowman: "Crossbowman",
  knight: "Knight",
  paladin: "Paladin",
};

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

export const formatCount = (count: number) => count.toLocaleString("en-US");
