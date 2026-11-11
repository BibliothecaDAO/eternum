import { configManager, readBuildingTiles } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { BUILDINGS_CENTER } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({ store: null as unknown }));

vi.mock("@/sync/active-game-client", () => ({
  requireActiveGameClient: () => ({
    views: { buildingTiles: (id: number) => readBuildingTiles(world.store as NativeFactStore, {} as never, id) },
  }),
}));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { paintedBuildingsScenario } from "@/lab/game/painted-buildings-scenario";

import { readRealm } from "./realm-facts";

afterEach(() => vi.restoreAllMocks());

/** The lab's painted Kingdom: realm 7 with its keep and eight buildings. */
function kingdom() {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  const { store } = paintedBuildingsScenario();
  world.store = store;
  useUIStore.setState({ structureEntityId: 7 });
  const projection = new WorldSpatialProjection({ store });
  projection.start();
  return { store, projection };
}

describe("the realm an address names", () => {
  it("is read with every building on its plot, as a model, and its keep at the centre", () => {
    const { store, projection } = kingdom();
    const realm = readRealm(store, projection, null)!;
    expect(realm.realmId).toBe(7);
    expect(realm.buildings).toHaveLength(9);
    for (const building of realm.buildings) expect(building.path).toMatch(/^\/models\/.+\.glb$/);
    const keep = realm.buildings.find(({ col, row }) => col === BUILDINGS_CENTER[0] && row === BUILDINGS_CENTER[1])!;
    expect(keep.path).toBe("/models/realms/kingdom.glb");
    // Each stands by one of the six turns its plot gives it.
    for (const { turn } of realm.buildings) expect((turn / (Math.PI / 3)) % 1).toBeCloseTo(0, 9);
  });

  it("holds a Kingdom's plots, three rings and the keep, among the ground of its land and the land round it", () => {
    const { store, projection } = kingdom();
    const realm = readRealm(store, projection, null)!;
    expect(realm.cells.filter((cell) => cell.plot)).toHaveLength(1 + 6 + 12 + 18);
    // Its own tile and the two rings of tiles round it, each a disk four hexes deep, none drawn twice.
    expect(realm.cells).toHaveLength(19 * 61);
    expect(new Set(realm.cells.map(({ col, row }) => `${col},${row}`)).size).toBe(realm.cells.length);
    for (const building of realm.buildings) {
      expect(realm.cells.find(({ col, row }) => col === building.col && row === building.row)?.plot).toBe(true);
    }
  });

  it("is none where no structure answers and no realm is picked", () => {
    const { store, projection } = kingdom();
    useUIStore.setState({ structureEntityId: 0 });
    expect(readRealm(store, projection, { col: 1, row: 1 })).toBeNull();
  });
});
