import { describe, expect, it } from "vitest";
import { Aspect, ASPECT_ORDERS, aspectOfOrder, aspectOrders, Giver } from "./aspects";
import { orders } from "./orders";

describe("Aspects", () => {
  it("place each of the 16 Orders in exactly one Aspect", () => {
    const placed = Object.values(ASPECT_ORDERS).flatMap((givers) => Object.values(givers));
    const realmOrders = orders.filter((order) => order.orderId !== 0).map((order) => order.orderId);
    expect(placed.toSorted((a, b) => a - b)).toEqual(realmOrders.toSorted((a, b) => a - b));
  });

  it("group the Orders as the design's table of givers does", () => {
    const names = (aspect: Aspect) =>
      aspectOrders(aspect).map((id) => orders.find((order) => order.orderId === id)?.orderName);
    expect(names(Aspect.Might)).toEqual(["Power", "Giants", "Titans", "Skill"]);
    expect(names(Aspect.Harmony)).toEqual(["Perfection", "Protection", "Enlightenment", "Brilliance"]);
    expect(names(Aspect.Chaos)).toEqual(["Fury", "Rage", "Vitriol", "Anger"]);
    expect(names(Aspect.Guile)).toEqual(["Twins", "Reflection", "Fox", "Detection"]);
  });

  it("give a held Realm its Order's Aspect", () => {
    expect(aspectOfOrder(ASPECT_ORDERS[Aspect.Chaos][Giver.Spoils])).toBe(Aspect.Chaos);
    expect(aspectOfOrder(4)).toBe(Aspect.Guile);
  });

  it("refuse the Order of Gods, which belongs to no Aspect", () => {
    expect(() => aspectOfOrder(0)).toThrow("Order 0 belongs to no Aspect");
  });
});
