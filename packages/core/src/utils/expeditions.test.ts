import { afterEach, describe, expect, it, vi } from "vitest";
import { StructureType } from "@bibliothecadao/types";
import * as timestamp from "./timestamp";
import { liveHomeArmies, structureMapPosition } from "./expeditions";

const structure = (overrides: {
  coord_x: number;
  coord_y: number;
  realm_id?: number;
  alt?: boolean;
  category?: StructureType;
}) =>
  ({
    game_id: 7,
    entity_id: 42,
    base: {
      coord_x: overrides.coord_x,
      coord_y: overrides.coord_y,
      alt: overrides.alt ?? false,
      category: overrides.category ?? StructureType.Realm,
    },
    metadata: { realm_id: overrides.realm_id ?? 3 },
  }) as never;

const expeditionRules = {
  SliceRules: { epoch_seconds: 86400 },
  SettlementRules: { spacing: 10 },
  GameRegistry: { start_main_at: 86400n },
};

const storeWith = (rows: Record<string, unknown>) => ({
  get: (model: string) => rows[model],
  require: (model: string) => {
    if (!(model in rows)) throw new Error(`missing ${model}`);
    return rows[model];
  },
});

describe("structureMapPosition", () => {
  afterEach(() => vi.restoreAllMocks());

  it("maps a Frontier realm from its parking coordinate to today's expedition site", () => {
    vi.spyOn(timestamp, "getBlockTimestamp").mockReturnValue({ currentBlockTimestamp: 86400 * 2 + 10 } as never);
    const store = storeWith({
      SliceRules: { epoch_seconds: 86400 },
      SettlementRules: { spacing: 10 },
      GameRegistry: { start_main_at: 86400n },
    });
    expect(
      structureMapPosition(store, structure({ coord_x: 0xffffffff - 3, coord_y: 0xffffffff, realm_id: 3 })),
    ).toEqual({
      x: 25,
      y: 45,
      alt: false,
    });
  });

  it("keeps every other structure on its own coordinate", () => {
    const store = storeWith({});
    expect(structureMapPosition(store, structure({ coord_x: 12, coord_y: 18 }))).toEqual({ x: 12, y: 18, alt: false });
    expect(structureMapPosition(store, structure({ coord_x: 12, coord_y: 0xffffffff, alt: true }))).toEqual({
      x: 12,
      y: 0xffffffff,
      alt: true,
    });
  });

  it("fails loudly on a parked realm in a game without expeditions", () => {
    const store = storeWith({ SliceRules: { epoch_seconds: 0 } });
    expect(() => structureMapPosition(store, structure({ coord_x: 1, coord_y: 0xffffffff }))).toThrow(
      "parked at the expedition sentinel",
    );
  });
});

describe("liveHomeArmies", () => {
  afterEach(() => vi.restoreAllMocks());

  const army = (explorer_id: number, y: number, count = 1_000n, owner = 42) =>
    ({ explorer_id, owner, coord: { x: 25, y, alt: false }, troops: { count } }) as never;
  const armiesStore = (rules: Record<string, unknown>, armies: unknown[]) => ({
    ...storeWith(rules),
    inGame: (model: string) => (model === "ExplorerTroops" ? armies : [])[Symbol.iterator](),
  });
  const atFloor = (seconds: number) =>
    vi.spyOn(timestamp, "getBlockTimestamp").mockReturnValue({ currentDefaultTick: seconds } as never);

  it("counts today's armies, and none from an earlier day once the day rolls over", () => {
    // Day one's region rows are 0..39 (spacing 10, four rows of regions a day); day two's are 40..79.
    const store = armiesStore(expeditionRules, [army(1, 5), army(2, 6), army(3, 7, 0n), army(4, 5, 1_000n, 99)]);
    atFloor(86400 + 60);
    expect(liveHomeArmies(store as never, 42, 7).map(({ explorer_id }) => explorer_id)).toEqual([1, 2]);

    atFloor(86400 * 2 + 1);
    expect(liveHomeArmies(store as never, 42, 7)).toEqual([]);
  });

  it("counts every army with troops in a game without expeditions", () => {
    const store = armiesStore({ SliceRules: { epoch_seconds: 0 } }, [army(1, 5), army(2, 900), army(3, 7, 0n)]);
    atFloor(86400 * 9);
    expect(liveHomeArmies(store as never, 42, 7).map(({ explorer_id }) => explorer_id)).toEqual([1, 2]);
  });
});
