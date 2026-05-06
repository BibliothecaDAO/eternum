import { describe, expect, it } from "vitest";
import type { StructureMapData } from "@bibliothecadao/eternum";

import { buildMockActiveTransfers } from "./transfer-route-overlay-mock";

const createStructure = (entityId: number, coordX: number, coordY: number): StructureMapData =>
  ({
    entity: `0x${entityId.toString(16)}`,
    entityId,
    coordX,
    coordY,
    structureType: 1,
    structureTypeName: "Realm",
    level: 1,
    ownerAddress: "1",
    ownerName: "Owner",
    guardArmies: [],
    activeProductions: [],
  }) as StructureMapData;

describe("buildMockActiveTransfers", () => {
  it("returns no mock transfers when fewer than two structures exist", () => {
    expect(buildMockActiveTransfers([createStructure(1, 0, 0)], 100_000)).toEqual([]);
  });

  it("builds deterministic active transfers from available structures", () => {
    const transfers = buildMockActiveTransfers(
      [
        createStructure(44, 4, 4),
        createStructure(11, 1, 1),
        createStructure(22, 2, 2),
        createStructure(33, 3, 3),
      ],
      100_000,
    );

    expect(transfers).toHaveLength(4);
    expect(transfers[0]).toMatchObject({
      id: "live:mock-11-22-0",
      sourceEntityId: 11,
      destinationEntityId: 22,
      resourceIds: [1],
    });
    expect(transfers.every((transfer) => transfer.startedAtMs < transfer.endsAtMs)).toBe(true);
    expect(transfers.every((transfer) => transfer.progress > 0 && transfer.progress < 1)).toBe(true);
  });
});
