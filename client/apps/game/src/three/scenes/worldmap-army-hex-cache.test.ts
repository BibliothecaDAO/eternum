import { describe, expect, it } from "vitest";
import { removeAllArmyHexEntriesForEntity } from "./worldmap-army-hex-cache";

type TestArmyHex = { id: number; owner: bigint };

function createArmyHexes(entries: Array<{ col: number; row: number; id: number }>): Map<number, Map<number, TestArmyHex>> {
  const armyHexes = new Map<number, Map<number, TestArmyHex>>();

  for (const entry of entries) {
    if (!armyHexes.has(entry.col)) {
      armyHexes.set(entry.col, new Map());
    }
    armyHexes.get(entry.col)?.set(entry.row, { id: entry.id, owner: 1n });
  }

  return armyHexes;
}

describe("removeAllArmyHexEntriesForEntity", () => {
  it("removes every cached coordinate for an entity id and preserves other armies", () => {
    const armyHexes = createArmyHexes([
      { col: 10, row: 11, id: 101 },
      { col: 11, row: 11, id: 101 },
      { col: 12, row: 12, id: 202 },
    ]);

    const removed = removeAllArmyHexEntriesForEntity({
      armyHexes,
      entityId: 101,
    });

    expect(removed).toEqual([
      { col: 10, row: 11 },
      { col: 11, row: 11 },
    ]);
    expect(armyHexes.get(10)?.get(11)).toBeUndefined();
    expect(armyHexes.get(11)?.get(11)).toBeUndefined();
    expect(armyHexes.get(12)?.get(12)).toEqual({ id: 202, owner: 1n });
  });
});
