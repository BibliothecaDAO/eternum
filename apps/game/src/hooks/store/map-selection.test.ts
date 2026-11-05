import { describe, expect, it } from "vitest";

import { deriveMapSelection, withoutSelectedTile } from "./map-selection";

const ARMY_TILE = { col: 12, row: 40 };

describe("a structure selected acting on a tile", () => {
  it("shows that tile, the structure still the one selected", () => {
    expect(deriveMapSelection({ kind: "structure", entityId: 7, tile: ARMY_TILE }, false)).toEqual({
      selectedEntityId: 7,
      selectedHex: ARMY_TILE,
    });
  });

  it("closes its tile's card back to the structure, which a second close lets go", () => {
    const acting = { kind: "structure", entityId: 7, tile: ARMY_TILE } as const;
    expect(withoutSelectedTile(acting)).toEqual({ kind: "structure", entityId: 7 });
    expect(withoutSelectedTile(withoutSelectedTile(acting))).toBeNull();
  });
});
