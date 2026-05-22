import { describe, expect, it } from "vitest";

import { resolveWorldmapHoverLabelTargets } from "./worldmap-hover-label-targets";

describe("resolveWorldmapHoverLabelTargets", () => {
  it("uses cached army targets before raycast fallback", () => {
    expect(
      resolveWorldmapHoverLabelTargets({
        cachedEntities: {
          army: { id: 1, owner: 1n },
        },
        hoveredHex: { col: 4, row: 5 },
        raycastArmy: {
          entityId: 2,
          position: { col: 4, row: 5 },
        },
      }),
    ).toEqual({ armyId: 1 });
  });

  it("uses the raycast army when the cache is empty and the position matches the hovered hex", () => {
    expect(
      resolveWorldmapHoverLabelTargets({
        cachedEntities: {},
        hoveredHex: { col: 4, row: 5 },
        raycastArmy: {
          entityId: 2,
          position: { col: 4, row: 5 },
        },
      }),
    ).toEqual({ armyId: 2 });
  });

  it("ignores raycast armies without a matching known position", () => {
    expect(
      resolveWorldmapHoverLabelTargets({
        cachedEntities: {},
        hoveredHex: { col: 4, row: 5 },
        raycastArmy: {
          entityId: 2,
          position: { col: 6, row: 5 },
        },
      }),
    ).toEqual({});

    expect(
      resolveWorldmapHoverLabelTargets({
        cachedEntities: {},
        hoveredHex: { col: 4, row: 5 },
        raycastArmy: {
          entityId: 2,
        },
      }),
    ).toEqual({});
  });

  it("passes structure and chest cached targets through unchanged", () => {
    expect(
      resolveWorldmapHoverLabelTargets({
        cachedEntities: {
          structure: { id: 3, owner: 1n },
          chest: { id: 4, owner: 0n },
        },
        hoveredHex: { col: 4, row: 5 },
      }),
    ).toEqual({ structureId: 3, chestId: 4 });
  });

  it("uses manager entities when the hover cache is missing visible labels", () => {
    expect(
      resolveWorldmapHoverLabelTargets({
        cachedEntities: {},
        hoveredHex: { col: 4, row: 5 },
        managerEntities: {
          army: { id: 2, owner: 1n },
          structure: { id: 3, owner: 1n },
          chest: { id: 4, owner: 0n },
        },
      }),
    ).toEqual({ armyId: 2, structureId: 3, chestId: 4 });
  });
});
