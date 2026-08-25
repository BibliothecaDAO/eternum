import { describe, expect, it } from "vitest";

import { resolveFastTravelMovement } from "./fast-travel-movement-policy";

const visibleHexWindow = [
  { col: 10, row: 9 },
  { col: 11, row: 9 },
  { col: 12, row: 9 },
  { col: 10, row: 10 },
  { col: 11, row: 10 },
  { col: 12, row: 10 },
  { col: 10, row: 11 },
  { col: 11, row: 11 },
  { col: 12, row: 11 },
];

describe("resolveFastTravelMovement", () => {
  it("finds a traversable hex path that avoids other armies on the visible surface", () => {
    const result = resolveFastTravelMovement({
      selectedArmyEntityId: "army-1",
      targetHexCoords: { col: 12, row: 10 },
      visibleHexWindow,
      armies: [
        {
          entityId: "army-1",
          hexCoords: { col: 10, row: 10 },
          ownerName: "Aurora",
        },
        {
          entityId: "army-2",
          hexCoords: { col: 11, row: 10 },
          ownerName: "Bastion",
        },
      ],
      spireAnchors: [],
    });

    expect(result).toMatchObject({
      selectedArmyEntityId: "army-1",
      originHexCoords: { col: 10, row: 10 },
      targetHexCoords: { col: 12, row: 10 },
      anchorHexes: [],
      pathHexes: [
        { col: 10, row: 10 },
        { col: 11, row: 9 },
        { col: 12, row: 9 },
        { col: 12, row: 10 },
      ],
    });
    expect(result?.worldPath).toHaveLength(4);
  });

  it("keeps spire anchor hexes explicit and traversable as movement targets", () => {
    const result = resolveFastTravelMovement({
      selectedArmyEntityId: "army-1",
      targetHexCoords: { col: 11, row: 9 },
      visibleHexWindow,
      armies: [
        {
          entityId: "army-1",
          hexCoords: { col: 10, row: 10 },
          ownerName: "Aurora",
        },
      ],
      spireAnchors: [
        {
          entityId: "spire-1",
          label: "North Spire",
          travelHexCoords: { col: 11, row: 9 },
          worldHexCoords: { col: 400, row: 120 },
        },
      ],
    });

    expect(result).toMatchObject({
      targetHexCoords: { col: 11, row: 9 },
      anchorHexes: [{ col: 11, row: 9 }],
      pathHexes: [
        { col: 10, row: 10 },
        { col: 11, row: 9 },
      ],
    });
  });
});
