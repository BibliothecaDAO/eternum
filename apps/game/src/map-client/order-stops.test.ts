import { describe, expect, it } from "vitest";

import { orderStops } from "./order-stops";

const at = (x: number) => ({ x, z: x * 10 });

describe("orderStops", () => {
  it("shows no order for no path", () => {
    expect(Array.from(orderStops([]))).toEqual([]);
  });

  it("repeats a two-hex path's ends to make its four stops", () => {
    expect(Array.from(orderStops([at(0), at(1)]))).toEqual([0, 0, 0, 0, 1, 10, 1, 10]);
  });

  it("takes four hexes of a longer path, its first and its last among them", () => {
    const path = [0, 1, 2, 3, 4, 5, 6].map(at);
    expect(Array.from(orderStops(path))).toEqual([0, 0, 2, 20, 4, 40, 6, 60]);
  });
});
