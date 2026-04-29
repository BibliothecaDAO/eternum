import { describe, expect, it } from "vitest";

import { planArmyPositionRepairs, type ArmyPositionRepairTarget } from "./worldmap-army-position-repair";

import type { HexEntityInfo, HexPosition, ID } from "@bibliothecadao/types";

class CountingMap<K, V> extends Map<K, V> {
  public iterationCount = 0;

  public override [Symbol.iterator](): MapIterator<[K, V]> {
    this.iterationCount += 1;
    return super[Symbol.iterator]();
  }
}

function createTarget(entityId: ID, canonicalPosition: HexPosition): ArmyPositionRepairTarget {
  return { entityId, canonicalPosition };
}

function createArmyHexes(entries: Array<{ col: number; row: number; entityId: ID }>) {
  const armyHexes = new CountingMap<number, Map<number, Pick<HexEntityInfo, "id">>>();

  entries.forEach(({ col, row, entityId }) => {
    if (!armyHexes.has(col)) {
      armyHexes.set(col, new Map());
    }
    armyHexes.get(col)?.set(row, { id: entityId });
  });

  return armyHexes;
}

describe("planArmyPositionRepairs", () => {
  it("plans stale army-hex removal and canonical cache repair", () => {
    const armyHexes = createArmyHexes([
      { col: 2, row: 2, entityId: 1 },
      { col: 5, row: 5, entityId: 1 },
      { col: 8, row: 8, entityId: 2 },
      { col: 12, row: 12, entityId: 3 },
    ]);
    const armiesPositions = new Map<ID, HexPosition>([
      [1, { col: 2, row: 2 }],
      [2, { col: 7, row: 7 }],
      [3, { col: 12, row: 12 }],
    ]);

    const repairs = planArmyPositionRepairs({
      armiesPositions,
      armyHexes,
      targets: [createTarget(1, { col: 5, row: 5 }), createTarget(2, { col: 7, row: 7 })],
    });

    expect(repairs).toEqual([
      {
        cachedPosition: { col: 2, row: 2 },
        shouldUpdatePositionCache: true,
        staleEntries: [{ col: 2, row: 2 }],
        target: createTarget(1, { col: 5, row: 5 }),
      },
      {
        cachedPosition: { col: 7, row: 7 },
        shouldUpdatePositionCache: true,
        staleEntries: [{ col: 8, row: 8 }],
        target: createTarget(2, { col: 7, row: 7 }),
      },
    ]);
  });

  it("skips active optimistic moves so local movement is not rewound by cache repair", () => {
    const armyHexes = createArmyHexes([
      { col: 2, row: 2, entityId: 1 },
      { col: 5, row: 5, entityId: 1 },
    ]);

    const repairs = planArmyPositionRepairs({
      armiesPositions: new Map([[1, { col: 2, row: 2 }]]),
      armyHexes,
      skipEntityIds: new Set([1]),
      targets: [createTarget(1, { col: 5, row: 5 })],
    });

    expect(repairs).toEqual([]);
    expect(armyHexes.iterationCount).toBe(0);
  });

  it("scans the army-hex cache once for all repair targets", () => {
    const armyHexes = createArmyHexes([
      { col: 2, row: 2, entityId: 1 },
      { col: 4, row: 4, entityId: 2 },
      { col: 6, row: 6, entityId: 3 },
    ]);

    planArmyPositionRepairs({
      armiesPositions: new Map<ID, HexPosition>(),
      armyHexes,
      targets: [
        createTarget(1, { col: 3, row: 3 }),
        createTarget(2, { col: 5, row: 5 }),
        createTarget(3, { col: 7, row: 7 }),
      ],
    });

    expect(armyHexes.iterationCount).toBe(1);
  });
});
