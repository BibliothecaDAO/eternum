import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { TileOccupier } from "@bibliothecadao/types";
import { hash } from "starknet";
import explorerFixture from "../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { afterEach, describe, expect, it } from "vitest";

import { hexesHeldBySelectedOwner } from "./worldmap-ownership-rings";

const GAME = 13;
const ALICE = 0xa11cen;
const BOB = 0xb0bn;

const disposers: Array<() => void> = [];
afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));

describe("hexes held by the selected realm's owner", () => {
  it("holds every structure the owner has and every living army out from one, on the layer shown", () => {
    const world = createWorld();
    world.structure({ id: 1, owner: ALICE, at: [10, 10], category: TileOccupier.RealmRegularLevel1 });
    world.structure({ id: 2, owner: ALICE, at: [12, 10], category: TileOccupier.Village });
    world.army({ id: 101, home: 1, at: [14, 11] });
    world.army({ id: 102, home: 2, at: [15, 15], alt: true });
    world.army({ id: 103, home: 1, at: [16, 16], count: 0n });
    world.structure({ id: 3, owner: BOB, at: [20, 20], category: TileOccupier.RealmRegularLevel1 });
    world.army({ id: 201, home: 3, at: [21, 21] });

    const alice = [hex(10, 10), hex(12, 10), hex(14, 11)];
    expect(world.heldBySelected({ col: 10, row: 10 })).toEqual(alice);
    expect(world.heldBySelected({ col: 12, row: 10 })).toEqual(alice);
    expect(world.heldBySelected({ col: 20, row: 20 })).toEqual([hex(20, 20), hex(21, 21)]);
  });

  it("holds nothing unless the selected hex holds a player's structure", () => {
    const world = createWorld();
    world.structure({ id: 1, owner: ALICE, at: [10, 10], category: TileOccupier.RealmRegularLevel1 });
    world.army({ id: 101, home: 1, at: [14, 11] });
    world.structure({ id: 4, owner: 0n, at: [30, 30], category: TileOccupier.Bank });

    expect(world.heldBySelected(null)).toEqual([]);
    expect(world.heldBySelected({ col: 14, row: 11 })).toEqual([]);
    expect(world.heldBySelected({ col: 11, row: 11 })).toEqual([]);
    expect(world.heldBySelected({ col: 30, row: 30 })).toEqual([]);
  });

  it("follows a capture and an army's move as the facts land", () => {
    const world = createWorld();
    world.structure({ id: 1, owner: ALICE, at: [10, 10], category: TileOccupier.RealmRegularLevel1 });
    world.structure({ id: 2, owner: ALICE, at: [12, 10], category: TileOccupier.Village });
    world.army({ id: 101, home: 1, at: [14, 11] });
    world.army({ id: 202, home: 2, at: [13, 12] });

    world.structure({ id: 2, owner: BOB, at: [12, 10], category: TileOccupier.Village });
    world.army({ id: 101, home: 1, at: [17, 11] });

    expect(world.heldBySelected({ col: 10, row: 10 })).toEqual([hex(10, 10), hex(17, 11)]);
    expect(world.heldBySelected({ col: 12, row: 10 })).toEqual([hex(12, 10), hex(13, 12)]);
  });
});

const hex = (col: number, row: number) => ({ alt: false, col, row });

function createWorld() {
  const store = new NativeFactStore();
  const projection = new WorldSpatialProjection({ store });
  projection.start();
  disposers.push(() => projection.dispose());
  const key = (...parts: (number | bigint)[]) => hash.computePoseidonHashOnElements(parts);
  const tileKey = (alt: boolean, col: number, row: number) => key(GAME, alt ? 1 : 0, col, row);
  const positions = new Map<number, { alt: boolean; col: number; row: number }>();

  /** An entity standing on one tile: the occupancy it leaves is removed with the one it takes. */
  const standOn = (entityId: number, alt: boolean, [col, row]: [number, number], category: number) => {
    const left = positions.get(entityId);
    positions.set(entityId, { alt, col, row });
    const moved = left && (left.alt !== alt || left.col !== col || left.row !== row);
    return [
      ...(moved ? [{ model: "TileOccupancy", key: tileKey(left.alt, left.col, left.row), value: null }] : []),
      {
        model: "TileOpt",
        key: tileKey(alt, col, row),
        value: { game_id: GAME, alt, col, row, data: 2n << 41n },
      },
      {
        model: "TileOccupancy",
        key: tileKey(alt, col, row),
        value: { game_id: GAME, alt, col, row, entity_id: entityId, category, is_structure: category < 15 },
      },
    ];
  };

  return {
    structure: ({ id, owner, at, category }: { id: number; owner: bigint; at: [number, number]; category: number }) =>
      store.applyFacts([
        {
          model: "Structure",
          key: key(GAME, id),
          value: {
            game_id: GAME,
            entity_id: id,
            owner,
            base: {
              category: 1,
              level: 0,
              created_at: "0x1",
              troop_max_guard_count: 0,
              troop_max_explorer_count: 0,
              starting_troops_granted: false,
            },
            resources_packed: "0x0",
            metadata: { realm_id: id, village_realm: 0, mine_kind: 0, deepest_depth: 0, has_wonder: false, order: 0 },
          },
        },
        ...standOn(id, false, at, category),
      ]),
    army: ({
      id,
      home,
      at,
      alt = false,
      count = 100n,
    }: {
      id: number;
      home: number;
      at: [number, number];
      alt?: boolean;
      count?: bigint;
    }) =>
      store.applyFacts([
        {
          model: "ExplorerTroops",
          key: key(GAME, id),
          value: {
            ...explorerFixture.expected.value,
            game_id: GAME,
            explorer_id: id,
            owner: home,
            troops: { ...explorerFixture.expected.value.troops, count },
          },
        },
        ...standOn(id, alt, at, TileOccupier.ExplorerKnightT1),
      ]),
    /** The held hexes in reading order: which hexes, not the order the store yields them in. */
    heldBySelected: (selected: { col: number; row: number } | null) =>
      hexesHeldBySelectedOwner({ store, projection, gameId: GAME }, selected, false).sort(
        (left, right) => left.col - right.col || left.row - right.row,
      ),
  };
}
