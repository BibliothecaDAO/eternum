import { describe, expect, it } from "vitest";
import { selectUnsyncedOwnedStructureTargets } from "./player-structure-sync-utils";

describe("selectUnsyncedOwnedStructureTargets", () => {
  it("returns valid unsynced owned structures", () => {
    const targets = selectUnsyncedOwnedStructureTargets({
      ownedStructures: [
        { entity_id: 10, coord_x: 4, coord_y: -2 },
        { entity_id: 11, coord_x: 5, coord_y: -3 },
      ],
      currentPlayerStructureIds: new Set([11]),
      inFlightStructureIds: new Set(),
    });

    expect(targets).toEqual([{ entityId: 10, position: { col: 4, row: -2 } }]);
  });

  it("skips structures already syncing or invalid payloads", () => {
    const targets = selectUnsyncedOwnedStructureTargets({
      ownedStructures: [
        { entity_id: 20, coord_x: 1, coord_y: 1 },
        { entity_id: 20, coord_x: 2, coord_y: 2 },
        { entity_id: 21, coord_x: Number.NaN, coord_y: 4 },
        { entity_id: 22, coord_x: 6, coord_y: 7 },
      ],
      currentPlayerStructureIds: new Set(),
      inFlightStructureIds: new Set([22]),
    });

    expect(targets).toEqual([{ entityId: 20, position: { col: 1, row: 1 } }]);
  });
});
