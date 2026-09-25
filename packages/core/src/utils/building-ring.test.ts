import { readFileSync } from "node:fs";
import { getHexDistance, getNeighborHexes } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { isMarkedPlot, markedPlot } from "./building-ring";

/** The contract's own record of 48 marked plots (frontier-ring-v1.txt): realm id, ring, inner col, inner row. */
const FIXTURE = new URL("../../../../contracts/l3/world-native/tests/fixtures/frontier-ring-v1.txt", import.meta.url);
const ROW_FELTS = 4;

const readRows = () => {
  const felts = readFileSync(FIXTURE, "utf8").trim().split(/\s+/).map(Number);
  const [version, count] = felts;
  if (version !== 1) throw new Error(`Ring fixture version ${version}`);
  if (felts.length !== 2 + count! * ROW_FELTS) throw new Error("Ring fixture length");
  return Array.from({ length: count! }, (_, index) => {
    const [realmId, ring, col, row] = felts.slice(2 + index * ROW_FELTS, 2 + (index + 1) * ROW_FELTS);
    return { realmId: realmId!, ring: ring!, plot: { col: col!, row: row! } };
  });
};

describe("the marked plot of each ring", () => {
  const rows = readRows();

  it("is the plot the contract derives for all 48 recorded realms and rings", () => {
    expect(rows).toHaveLength(48);
    for (const { realmId, ring, plot } of rows)
      expect({ realmId, ring, ...markedPlot(realmId, ring) }).toEqual({ realmId, ring, ...plot });
  });

  it("marks exactly that plot, and none of its neighbours on the same ring", () => {
    const centre = { col: 10, row: 10 };
    for (const { realmId, ring, plot } of rows) {
      expect(isMarkedPlot(realmId, plot)).toBe(true);
      const sameRing = getNeighborHexes(plot.col, plot.row).filter((hex) => getHexDistance(centre, hex) === ring);
      expect(sameRing.length).toBeGreaterThan(0);
      for (const neighbour of sameRing) expect(isMarkedPlot(realmId, neighbour)).toBe(false);
    }
  });

  it("never marks the castle", () => {
    expect(isMarkedPlot(1, { col: 10, row: 10 })).toBe(false);
  });
});
