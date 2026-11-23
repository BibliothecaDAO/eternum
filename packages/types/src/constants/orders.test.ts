import { describe, expect, it } from "vitest";
import { aspects, orders } from "./orders";

describe("Order Aspects", () => {
  it("places every canonical Order in exactly one of four complete Aspects", () => {
    expect(orders.map(({ orderId }) => orderId)).toEqual(Array.from({ length: 17 }, (_, index) => index));
    expect(orders.find(({ orderId }) => orderId === 0)?.aspect).toBeNull();
    expect(aspects.map(({ name }) => name)).toEqual(["Prowess", "Luminary", "Havoc", "Insight"]);
    expect(
      Object.fromEntries(
        aspects.map(({ id, name }) => [
          name,
          orders.filter(({ aspect }) => aspect === id).map(({ orderName }) => orderName),
        ]),
      ),
    ).toEqual({
      Prowess: ["Giants", "Skill", "Power", "Titans"],
      Luminary: ["Perfection", "Brilliance", "Protection", "Enlightenment"],
      Havoc: ["Rage", "Fury", "Vitriol", "Anger"],
      Insight: ["Fox", "Twins", "Reflection", "Detection"],
    });
  });
});
