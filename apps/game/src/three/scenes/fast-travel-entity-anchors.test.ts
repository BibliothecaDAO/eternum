import { describe, expect, it } from "vitest";

import { buildFastTravelEntityAnchors } from "./fast-travel-entity-anchors";

describe("buildFastTravelEntityAnchors", () => {
  it("anchors visible armies and spires onto fast-travel hex world positions", () => {
    const result = buildFastTravelEntityAnchors({
      visibleHexWindow: [
        { col: 8, row: 8 },
        { col: 9, row: 8 },
        { col: 10, row: 9 },
      ],
      armies: [
        {
          entityId: "army-1",
          hexCoords: { col: 9, row: 8 },
          ownerName: "Aurora",
        },
        {
          entityId: "army-2",
          hexCoords: { col: 30, row: 30 },
          ownerName: "Bastion",
        },
      ],
      spireAnchors: [
        {
          entityId: "spire-1",
          label: "North Spire",
          travelHexCoords: { col: 10, row: 9 },
          worldHexCoords: { col: 400, row: 120 },
        },
      ],
    });

    expect(result).toEqual([
      {
        entityId: "army-1",
        hexCoords: { col: 9, row: 8 },
        kind: "army",
        label: "Aurora",
        worldPosition: { x: 15.588457268119894, y: 0, z: 12 },
      },
      {
        entityId: "spire-1",
        hexCoords: { col: 10, row: 9 },
        kind: "spire",
        label: "North Spire",
        worldPosition: { x: 16.454482671904334, y: 0, z: 13.5 },
      },
    ]);
  });
});
