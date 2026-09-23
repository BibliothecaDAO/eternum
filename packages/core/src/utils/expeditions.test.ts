import { afterEach, describe, expect, it, vi } from "vitest";
import { StructureType } from "@bibliothecadao/types";
import * as timestamp from "./timestamp";
import { structureMapPosition } from "./expeditions";

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
