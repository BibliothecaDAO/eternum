import { describe, expect, it } from "vitest";
import { resolveArmyActionStartPosition } from "./army-start-position";

describe("resolveArmyActionStartPosition", () => {
  it("uses override position when provided", () => {
    const resolved = resolveArmyActionStartPosition({
      componentPosition: { col: 101, row: 202 },
      overridePosition: { col: 303, row: 404 },
    });

    expect(resolved).toEqual({ col: 303, row: 404 });
  });

  it("falls back to component position when override is missing", () => {
    const resolved = resolveArmyActionStartPosition({
      componentPosition: { col: 101, row: 202 },
    });

    expect(resolved).toEqual({ col: 101, row: 202 });
  });
});
