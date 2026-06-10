import { describe, expect, it } from "vitest";

import { findStructureAtHex } from "./structure-hex-lookup";

interface TestStructure {
  entityId: number;
  hexCoords: { col: number; row: number };
}

function makeStore(structures: TestStructure[]) {
  const byId = new Map(structures.map((s) => [s.entityId, s]));
  return (id: number) => byId.get(id);
}

describe("findStructureAtHex", () => {
  // Phase 3.4: the hover path resolved a structure by hex with an O(all structures)
  // scan + Array.from per group on every pointermove. Narrowing to the spatial
  // bucket's candidate ids means only the few structures in that bucket are checked,
  // but the exact-hex match must still be enforced (a bucket spans many hexes).
  it("returns the structure whose hex matches exactly", () => {
    const structures: TestStructure[] = [{ entityId: 1, hexCoords: { col: 5, row: 7 } }];
    const result = findStructureAtHex({ col: 5, row: 7 }, [1], makeStore(structures));
    expect(result).toBe(structures[0]);
  });

  it("ignores candidates in the same bucket that sit on a different hex", () => {
    const structures: TestStructure[] = [
      { entityId: 1, hexCoords: { col: 5, row: 7 } },
      { entityId: 2, hexCoords: { col: 6, row: 7 } }, // same bucket, different hex
    ];
    const result = findStructureAtHex({ col: 6, row: 7 }, [1, 2], makeStore(structures));
    expect(result?.entityId).toBe(2);
  });

  it("returns undefined when the bucket has no candidates", () => {
    expect(findStructureAtHex({ col: 0, row: 0 }, undefined, makeStore([]))).toBeUndefined();
  });

  it("skips candidate ids whose structure record is missing", () => {
    const structures: TestStructure[] = [{ entityId: 2, hexCoords: { col: 1, row: 1 } }];
    // id 1 has no record (stale index entry), id 2 matches
    const result = findStructureAtHex({ col: 1, row: 1 }, [1, 2], makeStore(structures));
    expect(result?.entityId).toBe(2);
  });

  it("returns undefined when no candidate sits on the target hex", () => {
    const structures: TestStructure[] = [{ entityId: 1, hexCoords: { col: 5, row: 7 } }];
    expect(findStructureAtHex({ col: 9, row: 9 }, [1], makeStore(structures))).toBeUndefined();
  });
});
