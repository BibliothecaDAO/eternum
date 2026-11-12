import { orders } from "./orders";

/**
 * Frontier Season 1's teams: four Aspects, each of four Orders (docs/plans/frontier-season-1.md, Aspects and the
 * hyperstructure). A value is the variant's name, as the native facts carry a Cairo enum.
 */
export enum Aspect {
  Might = "Might",
  Harmony = "Harmony",
  Chaos = "Chaos",
  Guile = "Guile",
}

/** The four Aspects in the design's order: the order every surface lists them in. */
export const ASPECTS = [Aspect.Might, Aspect.Harmony, Aspect.Chaos, Aspect.Guile] as const;

/**
 * What an Aspect's Orders give an army that earns a skill point: War to Knights, Paths to Scouts, Ward and Spoils to
 * every army (the design's Army boons).
 */
export enum Giver {
  War = "War",
  Ward = "Ward",
  Spoils = "Spoils",
  Paths = "Paths",
}

const GIVERS = [Giver.War, Giver.Ward, Giver.Spoils, Giver.Paths] as const;

/** An Order's id by its name in the Orders table; a name the table lacks throws. */
const orderNamed = (name: string): number => {
  const order = orders.find((entry) => entry.orderName === name);
  if (!order) throw new Error(`No Order is named ${name}`);
  return order.orderId;
};

/** Each Aspect's four Orders, one for each giver: the one table from Order to Aspect, all 16 Orders once. */
export const ASPECT_ORDERS: Record<Aspect, Record<Giver, number>> = {
  [Aspect.Might]: {
    [Giver.War]: orderNamed("Power"),
    [Giver.Ward]: orderNamed("Giants"),
    [Giver.Spoils]: orderNamed("Titans"),
    [Giver.Paths]: orderNamed("Skill"),
  },
  [Aspect.Harmony]: {
    [Giver.War]: orderNamed("Perfection"),
    [Giver.Ward]: orderNamed("Protection"),
    [Giver.Spoils]: orderNamed("Enlightenment"),
    [Giver.Paths]: orderNamed("Brilliance"),
  },
  [Aspect.Chaos]: {
    [Giver.War]: orderNamed("Fury"),
    [Giver.Ward]: orderNamed("Rage"),
    [Giver.Spoils]: orderNamed("Vitriol"),
    [Giver.Paths]: orderNamed("Anger"),
  },
  [Aspect.Guile]: {
    [Giver.War]: orderNamed("Twins"),
    [Giver.Ward]: orderNamed("Reflection"),
    [Giver.Spoils]: orderNamed("Fox"),
    [Giver.Paths]: orderNamed("Detection"),
  },
};

/** An Aspect's four Orders, in the givers' order. */
export const aspectOrders = (aspect: Aspect): number[] => GIVERS.map((giver) => ASPECT_ORDERS[aspect][giver]);

/** The Aspect an Order belongs to: a held Realm's Aspect is its Order's. An Order in no Aspect throws. */
export const aspectOfOrder = (order: number): Aspect => {
  const aspect = ASPECTS.find((candidate) => aspectOrders(candidate).includes(order));
  if (!aspect) throw new Error(`Order ${order} belongs to no Aspect`);
  return aspect;
};
