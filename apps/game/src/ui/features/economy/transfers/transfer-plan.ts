import { presentedMineKind } from "@bibliothecadao/eternum";
import { ResourcesIds, type Structure, StructureType } from "@bibliothecadao/types";

/** A good the source holds: its resource id, how much (whole units), and its weight per unit. */
export interface Good {
  resource: number;
  have: number;
  weightKg: number;
}

/** What a transfer's prefill rule tells holdings apart by. */
export type HoldingRole = "realm" | "rift" | "camp" | "other";

const ESSENCE_RIFT = 1;

/** A holding's role for the prefill rule: a realm, an Essence Rift (a mine of kind 1), a camp, or anything else. */
export const roleOf = (structure: Structure | undefined): HoldingRole => {
  if (!structure) return "other";
  if (structure.category === StructureType.Realm) return "realm";
  if (structure.category === StructureType.Camp) return "camp";
  return presentedMineKind(structure.structure) === ESSENCE_RIFT ? "rift" : "other";
};

/**
 * A good's plan: the total that leaves the source, and the destinations whose share the player set by hand. Every
 * other destination takes an even share of what the hand-set ones leave.
 */
export interface GoodPlan {
  total: number;
  /** Destination id → the share set by hand. */
  pinned: Map<number, number>;
}

/** Resource id → its plan. */
export type Plans = Map<number, GoodPlan>;

/** The donkeys a realm sends each rift so it can ship its Essence. */
const DONKEYS_TO_A_RIFT = 200;

/** A total shared evenly by `count` destinations, whole units; the remainder stays home. */
export const evenSplit = (total: number, count: number): number[] =>
  Array.from({ length: count }, () => Math.floor(total / Math.max(1, count)));

/**
 * The owner's prefill, by the ends' roles (2026-10-16), as each good's total: a realm sends each rift 200 donkeys, a
 * rift sends all its Essence, a camp sends everything it holds. Anything else opens at 0. Every destination must share
 * the role; the totals then split evenly among them.
 */
export const prefillTotals = (from: HoldingRole, to: HoldingRole[], goods: Good[]): Map<number, number> => {
  const all = (role: HoldingRole) => to.length > 0 && to.every((destination) => destination === role);
  const held = (resource: number) => goods.find((good) => good.resource === resource)?.have ?? 0;
  if (from === "realm" && all("rift"))
    return new Map([[ResourcesIds.Donkey, Math.min(DONKEYS_TO_A_RIFT * to.length, held(ResourcesIds.Donkey))]]);
  if (from === "rift" && all("realm")) return new Map([[ResourcesIds.Essence, held(ResourcesIds.Essence)]]);
  if (from === "camp" && all("realm")) return new Map(goods.map((good) => [good.resource, good.have]));
  return new Map();
};

/** Plans from totals, nothing set by hand. */
export const plansOf = (totals: Map<number, number>): Plans =>
  new Map([...totals].map(([resource, total]) => [resource, { total, pinned: new Map() }]));

/** Each destination's share of a good, in the destinations' order: the hand-set ones, the rest split evenly. */
export const sharesOf = (plan: GoodPlan | undefined, destinationIds: number[]): number[] => {
  if (!plan) return destinationIds.map(() => 0);
  const pinnedHere = destinationIds.filter((id) => plan.pinned.has(id));
  const pinnedSum = pinnedHere.reduce((sum, id) => sum + (plan.pinned.get(id) ?? 0), 0);
  const even = evenSplit(Math.max(0, plan.total - pinnedSum), destinationIds.length - pinnedHere.length);
  let next = 0;
  return destinationIds.map((id) => plan.pinned.get(id) ?? even[next++]);
};

/** A new total for a good, never more than the source holds; hand-set shares stay. */
export const withTotal = (plan: GoodPlan | undefined, total: number, have: number): GoodPlan => ({
  total: Math.min(have, Math.max(0, total)),
  pinned: plan?.pinned ?? new Map(),
});

/**
 * A destination's share set by hand: it never takes more than the source holds beside the other hand-set shares, and
 * the total grows to cover the hand-set shares when they pass it.
 */
export const withShare = (
  plan: GoodPlan | undefined,
  destinationId: number,
  amount: number,
  have: number,
  destinationIds: number[],
): GoodPlan => {
  const pinned = new Map(plan?.pinned ?? []);
  pinned.delete(destinationId);
  const othersPinned = destinationIds.reduce((sum, id) => sum + (pinned.get(id) ?? 0), 0);
  pinned.set(destinationId, Math.min(Math.max(0, amount), have - othersPinned));
  const pinnedSum = othersPinned + (pinned.get(destinationId) ?? 0);
  return { total: Math.min(have, Math.max(plan?.total ?? 0, pinnedSum)), pinned };
};

/** A destination's share back to the even split. */
export const withoutShare = (plan: GoodPlan, destinationId: number): GoodPlan => {
  const pinned = new Map(plan.pinned);
  pinned.delete(destinationId);
  return { ...plan, pinned };
};

/** The donkeys that carry a load: one per started capacity. */
export const donkeysFor = (weightKg: number, donkeyCapacityKg: number): number =>
  weightKg <= 0 ? 0 : Math.ceil(weightKg / donkeyCapacityKg);

/** The donkeys a transfer takes: each destination's goods are their own load. */
export const donkeysTaken = (plans: Plans, goods: Good[], destinationIds: number[], donkeyCapacityKg: number) => {
  const loads = destinationIds.map(() => 0);
  for (const good of goods) {
    sharesOf(plans.get(good.resource), destinationIds).forEach((share, index) => {
      loads[index] += share * good.weightKg;
    });
  }
  return loads.reduce((sum, load) => sum + donkeysFor(load, donkeyCapacityKg), 0);
};
