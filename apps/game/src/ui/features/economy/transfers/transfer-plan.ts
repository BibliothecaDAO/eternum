import { presentedMineKind } from "@bibliothecadao/eternum";
import { ResourcesIds, RIFT_MINE_KIND, type Structure, StructureType } from "@bibliothecadao/types";

/** A good the source holds: its resource id, how much (whole units), and its weight per unit. */
export interface Good {
  resource: number;
  have: number;
  weightKg: number;
}

/** What a transfer's prefill rule tells holdings apart by. */
export type HoldingRole = "realm" | "rift" | "camp" | "other";

/** A holding's role for the prefill rule: a realm, an Essence Rift (a mine of kind 1), a camp, or anything else. */
export const roleOf = (structure: Structure | undefined): HoldingRole => {
  if (!structure) return "other";
  if (structure.category === StructureType.Realm) return "realm";
  if (structure.category === StructureType.Camp) return "camp";
  return presentedMineKind(structure.structure) === RIFT_MINE_KIND ? "rift" : "other";
};

/**
 * A good's plan: the total the player asked to leave the source, and the shares they set by hand. What is sent comes
 * from `sharesOf`, never from these fields alone: the total is bounded by what the source holds now, and the hand-set
 * shares count only while they fit it.
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

/** What a player typed, as the whole units a transfer sends: a blank, a negative or a fraction never reaches it. */
export const wholeUnits = (typed: number): number => (Number.isFinite(typed) ? Math.max(0, Math.floor(typed)) : 0);

const sum = (values: Iterable<number>) => [...values].reduce((total, value) => total + value, 0);

/** A total shared evenly by `count` destinations in whole units, the first ones taking one more of the remainder. */
export const evenSplit = (total: number, count: number): number[] =>
  Array.from({ length: count }, (_, index) => Math.floor(total / count) + (index < total % count ? 1 : 0));

/**
 * The owner's prefill, by the ends' roles (2026-10-16), as each good's total: a realm sends each rift 200 donkeys, a
 * rift sends all its Essence, a camp sends everything it holds (its donkeys less those that carry the rest). Anything
 * else opens at 0. Every destination must share the role; the totals then split evenly among them.
 */
export const prefillTotals = (
  from: HoldingRole,
  to: HoldingRole[],
  goods: Good[],
  donkeyCapacityKg: number,
): Map<number, number> => {
  const all = (role: HoldingRole) => to.length > 0 && to.every((destination) => destination === role);
  const held = (resource: number) => goods.find((good) => good.resource === resource)?.have ?? 0;
  if (from === "realm" && all("rift"))
    return new Map([[ResourcesIds.Donkey, Math.min(DONKEYS_TO_A_RIFT * to.length, held(ResourcesIds.Donkey))]]);
  if (from === "rift" && all("realm")) return new Map([[ResourcesIds.Essence, held(ResourcesIds.Essence)]]);
  if (from === "camp" && all("realm")) return everythingACampHolds(goods, to.length, donkeyCapacityKg);
  return new Map();
};

/** Every good in full, and the donkeys the loads leave behind: a donkey sent away cannot carry. */
const everythingACampHolds = (goods: Good[], destinations: number, donkeyCapacityKg: number) => {
  const freight = new Map(
    goods.filter((good) => good.resource !== ResourcesIds.Donkey).map((good) => [good.resource, good.have]),
  );
  const ends = Array.from({ length: destinations }, (_, index) => index);
  const carrying = donkeysNeeded(plansOf(freight), goods, ends, donkeyCapacityKg);
  const spare = Math.max(0, (goods.find((good) => good.resource === ResourcesIds.Donkey)?.have ?? 0) - carrying);
  return spare > 0 ? freight.set(ResourcesIds.Donkey, spare) : freight;
};

/** Plans from totals, nothing set by hand. */
export const plansOf = (totals: Map<number, number>): Plans =>
  new Map([...totals].map(([resource, total]) => [resource, { total, pinned: new Map() }]));

/** What leaves the source of a good: the total asked, as far as the source holds it now. */
export const sentTotal = (plan: GoodPlan | undefined, have: number): number => Math.min(plan?.total ?? 0, have);

/**
 * The hand-set shares that count for these destinations: while they fit the total, and either leave a destination to
 * take the rest or are the whole of it. Otherwise none count and the total splits evenly, so the shares always add up
 * to the total shown.
 */
export const honouredShares = (
  plan: GoodPlan | undefined,
  destinationIds: number[],
  have: number,
): Map<number, number> => {
  const pinned = new Map(destinationIds.filter((id) => plan?.pinned.has(id)).map((id) => [id, plan!.pinned.get(id)!]));
  const total = sentTotal(plan, have);
  const leavesARest = pinned.size < destinationIds.length;
  const fits = leavesARest ? sum(pinned.values()) <= total : sum(pinned.values()) === total;
  return fits ? pinned : new Map();
};

/** Each destination's share of a good, in the destinations' order, adding up to what leaves the source. */
export const sharesOf = (plan: GoodPlan | undefined, destinationIds: number[], have: number): number[] => {
  const pinned = honouredShares(plan, destinationIds, have);
  const even = evenSplit(sentTotal(plan, have) - sum(pinned.values()), destinationIds.length - pinned.size);
  let next = 0;
  return destinationIds.map((id) => pinned.get(id) ?? even[next++]);
};

/** A new total for a good, in whole units, never more than the source holds; hand-set shares it cannot cover go. */
export const withTotal = (plan: GoodPlan | undefined, typed: number, have: number): GoodPlan => {
  const total = Math.min(have, wholeUnits(typed));
  const pinned = plan?.pinned ?? new Map<number, number>();
  return { total, pinned: sum(pinned.values()) > total ? new Map() : pinned };
};

/**
 * A destination's share set by hand, in whole units: never more than the source holds beside the other hand-set
 * shares. The total grows to cover the hand-set shares, and is their sum once every destination has one.
 */
export const withShare = (
  plan: GoodPlan | undefined,
  destinationId: number,
  typed: number,
  have: number,
  destinationIds: number[],
): GoodPlan => {
  const pinned = new Map([...(plan?.pinned ?? [])].filter(([id]) => destinationIds.includes(id)));
  pinned.delete(destinationId);
  const others = sum(pinned.values());
  pinned.set(destinationId, Math.min(wholeUnits(typed), Math.max(0, have - others)));
  const covered = sum(pinned.values());
  const total = pinned.size === destinationIds.length ? covered : Math.max(sentTotal(plan, have), covered);
  return { total: Math.min(have, total), pinned };
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

/**
 * The donkeys a transfer spends, as the chain spends them: the donkeys sent as goods, then for each destination the
 * donkeys that carry its load.
 */
export const donkeysNeeded = (plans: Plans, goods: Good[], destinationIds: number[], donkeyCapacityKg: number) => {
  const loads = destinationIds.map(() => 0);
  let sentAsGoods = 0;
  for (const good of goods) {
    sharesOf(plans.get(good.resource), destinationIds, good.have).forEach((share, index) => {
      loads[index] += share * good.weightKg;
      if (good.resource === ResourcesIds.Donkey) sentAsGoods += share;
    });
  }
  return sentAsGoods + sum(loads.map((load) => donkeysFor(load, donkeyCapacityKg)));
};
