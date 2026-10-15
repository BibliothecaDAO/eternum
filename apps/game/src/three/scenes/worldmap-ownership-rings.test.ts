import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { TileOccupier, type HexPosition } from "@bibliothecadao/types";
import { hash } from "starknet";
import explorerFixture from "../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWorldmapInteractionAdapter } from "./worldmap-interaction-adapter";
import { bindOwnershipRings } from "./worldmap-ownership-rings";
import { bindSelectionToMovingStructures } from "./worldmap-selection-follow";

vi.mock("@/audio/core/AudioManager", () => ({ AudioManager: { getInstance: () => ({ play: () => {} }) } }));

const GAME = 13;
const ALICE = 0xa11cen;
const BOB = 0xb0bn;
const DAY = 86_400;

const disposers: Array<() => void> = [];
beforeEach(() => {
  configManager.setActiveGame(GAME, 1);
  // A map centred on 0: a contract hex and its scene hex are the same numbers.
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(0);
  useUIStore.setState({ selectedHex: null, mapLayer: false });
});
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

describe("ownership rings", () => {
  it("ring every structure the selected realm's owner holds and every living army out from one", () => {
    const world = createWorld();
    world.structure({ id: 1, owner: ALICE, at: [10, 10], category: TileOccupier.RealmRegularLevel1 });
    world.structure({ id: 2, owner: ALICE, at: [12, 10], category: TileOccupier.Village });
    world.army({ id: 101, home: 1, at: [14, 11] });
    world.army({ id: 102, home: 2, at: [15, 15], alt: true });
    world.army({ id: 103, home: 1, at: [16, 16], count: 0n });
    world.structure({ id: 3, owner: BOB, at: [20, 20], category: TileOccupier.RealmRegularLevel1 });
    world.army({ id: 201, home: 3, at: [21, 21] });
    const rings = world.bindRings();

    select(10, 10);
    expect(rings.shown()).toEqual([hex(10, 10), hex(12, 10), hex(14, 11)]);
    select(12, 10);
    expect(rings.shown()).toEqual([hex(10, 10), hex(12, 10), hex(14, 11)]);
    select(20, 20);
    expect(rings.shown()).toEqual([hex(20, 20), hex(21, 21)]);
    useUIStore.getState().setSelectedHex(null);
    expect(rings.shown()).toEqual([]);
  });

  it("ring nothing unless the selected hex holds a player's structure", () => {
    const world = createWorld();
    world.structure({ id: 1, owner: ALICE, at: [10, 10], category: TileOccupier.RealmRegularLevel1 });
    world.army({ id: 101, home: 1, at: [14, 11] });
    world.structure({ id: 4, owner: 0n, at: [30, 30], category: TileOccupier.Bank });
    const rings = world.bindRings();

    for (const [col, row] of [
      [14, 11],
      [11, 11],
      [30, 30],
    ]) {
      select(col, row);
      expect(rings.shown()).toEqual([]);
    }
  });

  it("follow a capture and an army's move as the facts land", () => {
    const world = createWorld();
    world.structure({ id: 1, owner: ALICE, at: [10, 10], category: TileOccupier.RealmRegularLevel1 });
    world.structure({ id: 2, owner: ALICE, at: [12, 10], category: TileOccupier.Village });
    world.army({ id: 101, home: 1, at: [14, 11] });
    world.army({ id: 202, home: 2, at: [13, 12] });
    const rings = world.bindRings();
    select(12, 10);

    world.structure({ id: 2, owner: BOB, at: [12, 10], category: TileOccupier.Village });
    expect(rings.shown()).toEqual([hex(12, 10), hex(13, 12)]);

    select(10, 10);
    world.army({ id: 101, home: 1, at: [17, 11] });
    world.projection.flush();
    expect(rings.shown()).toEqual([hex(10, 10), hex(17, 11)]);
  });

  it("follow a selected Frontier realm to its next day's site, and clear when its vacated site is clicked", () => {
    // Four-hour units from day ten: day 0 lasts 12 hours. Realm 21 and 22 rise on their sites from seed 1.
    setBlockTimestampSource(() => DAY * 10 + 100);
    const world = createWorld({ expedition: { dayUnitSeconds: 14_400, spacing: 16, startMainAt: DAY * 10 } });
    world.realm({ id: 21, realmId: 3, level: 1, owner: ALICE });
    world.realm({ id: 22, realmId: 4, level: 0, owner: ALICE });
    world.army({ id: 101, home: 21, at: [330, 10] });
    // The runtime publishes each applied slice; the realms stand on their day-0 sites before the day turns.
    world.projection.flush();
    const rings = world.bindRings();

    world.click(328, 8);
    expect(rings.shown()).toEqual([hex(328, 8), hex(330, 10), hex(344, 8)]);

    setBlockTimestampSource(() => DAY * 11 + 100);
    world.projection.rebuild();
    expect(useUIStore.getState().selectedHex).toEqual(hex(328, 72));
    expect(rings.shown()).toEqual([hex(328, 72), hex(330, 10), hex(344, 72)]);

    world.click(328, 8);
    expect(rings.shown()).toEqual([]);
    world.click(328, 8);
    expect(rings.shown()).toEqual([]);
    world.click(344, 72);
    expect(rings.shown()).toEqual([hex(328, 72), hex(330, 10), hex(344, 72)]);
  });

  it("name whatever structure stands on the selected hex now, as the tile panel does", () => {
    setBlockTimestampSource(() => DAY * 10 + 100);
    const world = createWorld({ expedition: { dayUnitSeconds: 14_400, spacing: 16, startMainAt: DAY * 10 } });
    world.realm({ id: 21, realmId: 3, level: 1, owner: ALICE });
    world.realm({ id: 22, realmId: 4, level: 0, owner: ALICE });
    world.projection.flush();
    const rings = world.bindRings();

    world.click(344, 72);
    expect(rings.shown()).toEqual([]);

    setBlockTimestampSource(() => DAY * 11 + 100);
    world.projection.rebuild();
    expect(rings.shown()).toEqual([hex(328, 72), hex(344, 72)]);
  });
});

const hex = (col: number, row: number): HexPosition => ({ col, row });
const select = (col: number, row: number) => useUIStore.getState().setSelectedHex({ col, row });

function createWorld(options: { expedition?: { dayUnitSeconds: number; spacing: number; startMainAt: number } } = {}) {
  const facts = new NativeFactStore();
  // Frontier's calendar and grid are read through the same store; the world answers them without full rule rows.
  const rules = new Map<string, object>();
  if (options.expedition) {
    rules.set("SliceRules", { game_id: GAME, day_unit_seconds: options.expedition.dayUnitSeconds });
    rules.set("SettlementRules", { game_id: GAME, spacing: options.expedition.spacing });
    rules.set("GameRegistry", { game_id: GAME, start_main_at: BigInt(options.expedition.startMainAt), seed: 1n });
  }
  const store = {
    entries: facts.entries.bind(facts),
    entityOccupancy: facts.entityOccupancy.bind(facts),
    structuresOwnedBy: facts.structuresOwnedBy.bind(facts),
    armiesAtHome: facts.armiesAtHome.bind(facts),
    subscribe: facts.subscribe.bind(facts),
    get: ((model: string, keys: object) => rules.get(model) ?? facts.get(model as "TileOpt", keys as never)) as never,
    require: ((model: string, keys: object) =>
      rules.get(model) ?? facts.require(model as "TileOpt", keys as never)) as never,
  } as Pick<
    NativeFactStore,
    "entries" | "entityOccupancy" | "structuresOwnedBy" | "armiesAtHome" | "subscribe" | "get" | "require"
  >;
  const projection = new WorldSpatialProjection({ store });
  projection.start();
  const adapter = createWorldmapInteractionAdapter({
    state: {
      get selectedHex() {
        return useUIStore.getState().selectedHex;
      },
      setSelectedHex: (hex) => useUIStore.getState().setSelectedHex(hex),
      setStructureEntityId: () => {},
    },
  });
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
  const structureRow = (id: number, owner: bigint, category: number, level: number, realmId: number) => ({
    model: "Structure",
    key: key(GAME, id),
    value: {
      game_id: GAME,
      entity_id: id,
      owner,
      base: {
        category,
        level,
        created_at: "0x1",
        troop_max_guard_count: 0,
        troop_max_explorer_count: 0,
        starting_troops_granted: false,
      },
      resources_packed: "0x0",
      metadata: { realm_id: realmId, village_realm: 0, mine_kind: 0, deepest_depth: 0, has_wonder: false, order: 0 },
    },
  });

  return {
    projection,
    /** A Blitz structure on its own tile. */
    structure: ({ id, owner, at, category }: { id: number; owner: bigint; at: [number, number]; category: number }) =>
      facts.applyFacts([structureRow(id, owner, 1, 0, id), ...standOn(id, false, at, category)]),
    /** A Frontier realm: no tile of its own, raised each day on the site the contract computes. */
    realm: ({ id, realmId, level, owner }: { id: number; realmId: number; level: number; owner: bigint }) =>
      facts.applyFacts([structureRow(id, owner, 1, level, realmId)]),
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
      facts.applyFacts([
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
    /** A click on a contract hex, through the map's interaction boundary. */
    click: (col: number, row: number) =>
      adapter.selectHex({ contractHexPosition: { x: col, y: row }, isMine: false, position: { x: 0, z: 0 } }),
    /** Binds the rings and the selection as the world map does; `shown` is the last ringed set, in reading order. */
    bindRings: () => {
      let shown: readonly HexPosition[] = [];
      disposers.push(bindOwnershipRings({ store, projection, rings: { show: (hexes) => (shown = hexes) } }));
      disposers.push(
        bindSelectionToMovingStructures({
          projection,
          moveSelection: (hex) => useUIStore.getState().setSelectedHex(hex),
        }),
      );
      return {
        shown: () => [...shown].sort((left, right) => left.col - right.col || left.row - right.row),
      };
    },
  };
}
