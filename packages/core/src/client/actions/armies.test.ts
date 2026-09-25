// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { getNeighborHexes, StructureType, BiomeType } from "@bibliothecadao/types";
import * as timestamp from "../../utils/timestamp";

// Through the barrel, as the app loads core: the managers resolve their cross-imports off it.
import { ActionPaths, ActionType, configManager, createGameActions } from "../../index";

const parkedRealm = {
  game_id: 7,
  entity_id: 42,
  base: {
    coord_x: 0xffffffff - 3,
    coord_y: 0xffffffff,
    alt: false,
    category: StructureType.Realm,
    troop_max_guard_count: 0,
  },
  metadata: { realm_id: 3 },
};

const rows: Record<string, unknown> = {
  Structure: parkedRealm,
  SliceRules: { epoch_seconds: 86400 },
  SettlementRules: { spacing: 10 },
  GameRegistry: { start_main_at: 86400n },
};

const client = {
  setup: {
    store: {
      get: (model: string) => rows[model],
      require: (model: string) => {
        if (!(model in rows)) throw new Error(`missing ${model}`);
        return rows[model];
      },
    },
  },
} as never;

describe("structure paths", () => {
  afterEach(() => vi.restoreAllMocks());

  it("plans a Frontier realm's musters around today's site, not its parked coordinate", () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(7);
    vi.spyOn(configManager, "getTroopConfig").mockReturnValue({
      troop_limit_config: { guard_resurrection_delay: 0 },
    } as never);
    vi.spyOn(configManager, "getTick").mockReturnValue(1);
    vi.spyOn(configManager, "getMapCenter").mockReturnValue(0);
    vi.spyOn(timestamp, "getBlockTimestamp").mockReturnValue({ currentBlockTimestamp: 86400 * 2 + 10 } as never);

    const input = {
      structureId: 42,
      armyHexes: new Map(),
      exploredHexes: new Map<number, Map<number, BiomeType>>(),
      playerAddress: 1n,
    };
    expect(createGameActions(client).structurePaths(input).getPaths().size).toBe(0);
    const site = { col: 25, row: 45 };
    for (const { col, row } of getNeighborHexes(site.col, site.row)) {
      const column = input.exploredHexes.get(col) ?? new Map<number, BiomeType>();
      column.set(row, 1 as BiomeType);
      input.exploredHexes.set(col, column);
    }
    const paths = createGameActions(client).structurePaths(input);

    const musters = [...paths.getPaths().values()]
      .filter((path) => ActionPaths.getActionType(path) === ActionType.CreateArmy)
      .map((path) => path[path.length - 1].hex);
    expect(musters).toHaveLength(6);
    expect(musters).toEqual(
      expect.arrayContaining(getNeighborHexes(site.col, site.row).map(({ col, row }) => ({ col, row }))),
    );
  });
});
