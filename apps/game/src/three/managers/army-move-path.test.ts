import { describe, expect, it } from "vitest";
import { isRoutable, orderedRouteFor, resolveMovementPath } from "./army-move-path";

describe("resolveMovementPath", () => {
  const start = { id: "start" };
  const target = { id: "target" };

  it("falls back to direct path when worker returns null", () => {
    const resolved = resolveMovementPath(start, target, null);
    expect(resolved).toEqual([start, target]);
  });

  it("falls back to direct path when worker returns single-node path", () => {
    const resolved = resolveMovementPath(start, target, [start]);
    expect(resolved).toEqual([start, target]);
  });

  it("keeps worker path when it has at least two nodes", () => {
    const waypoint = { id: "waypoint" };
    const path = [start, waypoint, target];
    const resolved = resolveMovementPath(start, target, path);
    expect(resolved).toBe(path);
  });
});

describe("orderedRouteFor", () => {
  const hex = (x: number, y: number) => ({ getNormalized: () => ({ x, y }) });
  const route = [hex(1, 1), hex(2, 1), hex(3, 2)];

  it("walks the ordered route when the facts move the army from its start to its end", () => {
    expect(orderedRouteFor(route, hex(1, 1), hex(3, 2))).toBe(route);
  });

  it("leaves a route that ends elsewhere, or starts elsewhere, to the path worker", () => {
    expect(orderedRouteFor(route, hex(1, 1), hex(2, 1))).toBeNull();
    expect(orderedRouteFor(route, hex(0, 1), hex(3, 2))).toBeNull();
  });

  it("has no route for an army no order was given", () => {
    expect(orderedRouteFor(undefined, hex(1, 1), hex(3, 2))).toBeNull();
    expect(orderedRouteFor([hex(1, 1)], hex(1, 1), hex(1, 1))).toBeNull();
  });
});

describe("isRoutable", () => {
  const hex = (x: number, y: number) => ({ getNormalized: () => ({ x, y }) });

  it("asks for a route within the army's reach", () => {
    expect(isRoutable(hex(10, 10), hex(13, 10), 5)).toBe(true);
    expect(isRoutable(hex(10, 10), hex(15, 10), 5)).toBe(true);
  });

  it("asks for none past it, as entering a depth a region down is", () => {
    expect(isRoutable(hex(10, 10), hex(16, 10), 5)).toBe(false);
    expect(isRoutable(hex(10, 10), hex(10, 210), 40)).toBe(false);
  });
});
