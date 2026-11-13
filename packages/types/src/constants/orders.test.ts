import { describe, expect, it } from "vitest";
import { aspects, orders } from "./orders";

describe("Order Aspects", () => {
  it("places every canonical Order in exactly one of four complete Aspects", () => {
    expect(orders.map(({ orderId }) => orderId)).toEqual(Array.from({ length: 17 }, (_, index) => index));
    expect(orders.find(({ orderId }) => orderId === 0)?.aspect).toBeNull();
    expect(aspects.map(({ name }) => name)).toEqual(["Might", "Harmony", "Chaos", "Guile"]);
    expect(
      Object.fromEntries(
        aspects.map(({ id, name }) => [
          name,
          orders.filter(({ aspect }) => aspect === id).map(({ orderName }) => orderName),
        ]),
      ),
    ).toEqual({
      Might: ["Giants", "Skill", "Power", "Titans"],
      Harmony: ["Perfection", "Brilliance", "Protection", "Enlightenment"],
      Chaos: ["Rage", "Fury", "Vitriol", "Anger"],
      Guile: ["Fox", "Twins", "Reflection", "Detection"],
    });
  });
});
