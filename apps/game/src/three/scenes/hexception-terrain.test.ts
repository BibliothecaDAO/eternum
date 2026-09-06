import { describe, expect, it } from "vitest";
import { createLocalTerrainLabRequest } from "@/three/debug/local-terrain-lab";
import { getLocalHexDisk } from "./hexception-terrain";

describe("shared local terrain", () => {
  it.each([1, 2, 3, 4, 5])("keeps radius %s buildable cells inside a complete terrain surround", (radius) => {
    const request = createLocalTerrainLabRequest(radius);
    expect(request.cells.filter((cell) => cell.occupied)).toHaveLength(1 + 3 * radius * (radius + 1));
    expect(request.cells).toHaveLength(1 + 3 * (radius + 2) * (radius + 3));
    expect(request.settlementAnchors).toHaveLength(1 + 3 * radius * (radius + 1));
    expect(new Set(request.cells.map((cell) => `${cell.col}:${cell.row}`)).size).toBe(request.cells.length);
    expect(request.subdivisions).toBe(2);
  });

  it("preserves parity across negative and positive rows", () => {
    for (const row of [-3, 0, 3]) {
      const cells = getLocalHexDisk({ col: -5, row }, 3);
      expect(cells).toHaveLength(37);
      expect(cells.filter((cell) => cell.isBorder)).toHaveLength(18);
    }
  });
});
