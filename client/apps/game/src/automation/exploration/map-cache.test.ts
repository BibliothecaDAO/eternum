import { beforeEach, describe, expect, it, vi } from "vitest";

const { tileMap, getMapFromToriiExactMock, getEntitiesFromToriiMock } = vi.hoisted(() => ({
  tileMap: new Map<string, any>(),
  getMapFromToriiExactMock: vi.fn(async () => {}),
  getEntitiesFromToriiMock: vi.fn(async () => {}),
}));

vi.mock("@/dojo/queries", () => ({
  getMapFromToriiExact: getMapFromToriiExactMock,
  getEntitiesFromTorii: getEntitiesFromToriiMock,
}));

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: (component: unknown, entity: unknown) => {
    if (component instanceof Map) {
      return component.get(entity);
    }
    return undefined;
  },
}));

vi.mock("@dojoengine/utils", () => ({
  getEntityIdFromKeys: (keys: bigint[]) => keys[0].toString(),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  DEFAULT_COORD_ALT: 0,
  Position: class {
    private readonly x: number;
    private readonly y: number;

    constructor({ x, y }: { x: number; y: number }) {
      this.x = x;
      this.y = y;
    }

    getNormalized() {
      return { x: this.x, y: this.y };
    }
  },
  configManager: {
    getSeasonConfig: () => ({
      startSettlingAt: 1,
      startMainAt: 2,
      endAt: 3,
    }),
  },
  getTileAt: (_components: unknown, _alt: number, col: number, row: number) => tileMap.get(`${col},${row}`),
  isTileOccupierChest: (value: number) => value === 2,
  isTileOccupierQuest: (value: number) => value === 3,
  isTileOccupierStructure: (value: number) => value === 1,
}));

import { buildExplorationSnapshot } from "./map-cache";

describe("buildExplorationSnapshot", () => {
  beforeEach(() => {
    tileMap.clear();
    getMapFromToriiExactMock.mockClear();
    getEntitiesFromToriiMock.mockClear();
  });

  it("resolves real owners for structure and army occupiers", async () => {
    const explorerOwnerStructureId = 2001;
    const structureId = 201;
    const armyId = 301;

    const structureOwner = 0xabcden;
    const armyOwner = 0x98765n;

    const components = {
      ExplorerTroops: new Map([
        ["1", { coord: { x: 10, y: 10 } }],
        [armyId.toString(), { owner: explorerOwnerStructureId }],
      ]),
      Structure: new Map([
        [structureId.toString(), { owner: structureOwner }],
        [explorerOwnerStructureId.toString(), { owner: armyOwner }],
      ]),
    };

    tileMap.set("10,11", {
      biome: 1,
      occupier_id: structureId,
      occupier_type: 1,
    });

    tileMap.set("11,10", {
      biome: 1,
      occupier_id: armyId,
      occupier_type: 99,
    });

    const snapshot = await buildExplorationSnapshot({
      components: components as any,
      contractComponents: [] as any,
      toriiClient: {} as any,
      explorerId: 1,
      scopeRadius: 1,
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.structureHexes.get(10)?.get(11)?.owner).toBe(structureOwner);
    expect(snapshot?.armyHexes.get(11)?.get(10)?.owner).toBe(armyOwner);
  });
});
