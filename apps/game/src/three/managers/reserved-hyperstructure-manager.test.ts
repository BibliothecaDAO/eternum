import type { StructureSpatialProjectionChange } from "@bibliothecadao/eternum/game-sync";
import { describe, expect, it } from "vitest";
import { changesTouchReservedSites } from "./reserved-hyperstructure-manager";

const change = (input: {
  previous?: { reserved: boolean };
  current?: { reserved: boolean };
}): StructureSpatialProjectionChange =>
  ({
    kind: "structure",
    spatialId: "entity:1",
    previous: input.previous as never,
    current: input.current as never,
  }) as StructureSpatialProjectionChange;

describe("changesTouchReservedSites", () => {
  it("ignores ordinary structure churn", () => {
    expect(changesTouchReservedSites([change({ previous: { reserved: false }, current: { reserved: false } })])).toBe(
      false,
    );
    expect(changesTouchReservedSites([change({ current: { reserved: false } })])).toBe(false);
    expect(changesTouchReservedSites([])).toBe(false);
  });

  it("rebuilds when a reserved site appears, moves, or is claimed", () => {
    expect(changesTouchReservedSites([change({ current: { reserved: true } })])).toBe(true);
    expect(changesTouchReservedSites([change({ previous: { reserved: true }, current: { reserved: false } })])).toBe(
      true,
    );
    expect(changesTouchReservedSites([change({ previous: { reserved: true } })])).toBe(true);
  });
});
