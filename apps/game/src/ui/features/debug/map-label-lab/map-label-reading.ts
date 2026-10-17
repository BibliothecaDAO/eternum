import type { MapLabelEntity, MapLabelTroops } from "@/three/debug/map-label-lab-fixture";

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

/** Strength per troop by tier, as the game's troop limits read it (`tierStrength`, Frontier 1 / 3 / 9). */
const TIER_STRENGTH = { 1: 1, 2: 3, 3: 9 } as const;

export const troopStrength = (troops: readonly MapLabelTroops[]): number =>
  troops.reduce((total, stack) => total + stack.count * TIER_STRENGTH[stack.tier], 0);

/** What a thing's strength is to the viewer, against their strongest army: the one glance the map must answer. */
export type Standing = "stronger" | "even" | "weaker" | "open";

export const standingOf = (strength: number, mine: number): Standing => {
  if (strength === 0) return "open";
  const ratio = strength / Math.max(1, mine);
  if (ratio >= 1.25) return "stronger";
  if (ratio >= 0.8) return "even";
  return "weaker";
};

/** The viewer's strongest army: what every other thing is weighed against. */
export const strongestOwnArmy = (entities: readonly MapLabelEntity[]): number =>
  Math.max(0, ...entities.filter((e) => e.relation === "own" && e.army).map((e) => troopStrength([e.army!.troops])));

/**
 * A guard on the plate, tier always before number: one slot as "T3 1,500"; several as their tiers in slot order, then
 * the total ("T1 T1 T1 T3", "2,400"); none, open.
 */
export const guardLine = (guards: readonly MapLabelTroops[]): { tiers: string[]; total: string } | null => {
  if (guards.length === 0) return null;
  const total = formatCount(guards.reduce((sum, slot) => sum + slot.count, 0));
  return { tiers: guards.map((slot) => `T${slot.tier}`), total };
};

export const formatCount = (count: number) => count.toLocaleString("en-US");
