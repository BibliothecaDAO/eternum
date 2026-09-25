import { afterEach, describe, expect, it, vi } from "vitest";
import { StructureType } from "@bibliothecadao/types";
import * as timestamp from "./timestamp";
import { openSpawnDirections } from "./army";

const realm = () =>
  ({
    game_id: 7,
    entity_id: 42,
    base: { category: StructureType.Realm },
    metadata: { realm_id: 3 },
  }) as never;

const storeWith = (rules: Record<string, unknown>) =>
  ({
    get: (model: string) => rules[model],
    entityOccupancy: () => ({ alt: false, col: 12, row: 18 }),
    require: (model: string) => {
      if (!(model in rules)) throw new Error(`missing ${model}`);
      return rules[model];
    },
  }) as never;

const frontier = {
  SliceRules: { epoch_seconds: 86400 },
  SettlementRules: { spacing: 10 },
  GameRegistry: { start_main_at: 86400n },
};
const nothingExplored = () => undefined;

describe("openSpawnDirections", () => {
  afterEach(() => vi.restoreAllMocks());

  it("offers all six hexes around a realm in a fresh Frontier region, which the contract reveals as it musters", () => {
    vi.spyOn(timestamp, "getBlockTimestamp").mockReturnValue({ currentBlockTimestamp: 86400 * 2 + 10 } as never);
    const parked = realm();
    expect(openSpawnDirections(storeWith(frontier), parked, nothingExplored)).toHaveLength(6);
  });

  it("keeps an occupied explored hex closed in a Frontier region", () => {
    vi.spyOn(timestamp, "getBlockTimestamp").mockReturnValue({ currentBlockTimestamp: 86400 * 2 + 10 } as never);
    const parked = realm();
    const occupiedFirst = (hex: { col: number; row: number }) => (hex.col === 26 && hex.row === 45 ? 99 : undefined);
    expect(openSpawnDirections(storeWith(frontier), parked, occupiedFirst)).toHaveLength(5);
  });

  it("offers only explored free hexes where the game has no expeditions", () => {
    const home = realm();
    expect(openSpawnDirections(storeWith({ SliceRules: { epoch_seconds: 0 } }), home, nothingExplored)).toEqual([]);
    expect(openSpawnDirections(storeWith({ SliceRules: { epoch_seconds: 0 } }), home, () => 0)).toHaveLength(6);
  });
});
