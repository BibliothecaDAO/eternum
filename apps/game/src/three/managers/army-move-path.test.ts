import { describe, expect, it } from "vitest";
import { resolveMovementPath } from "./army-move-path";

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
