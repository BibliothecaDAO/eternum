import { afterEach, describe, expect, it, vi } from "vitest";
import { StructureType, getLayerNeighborHexes } from "@bibliothecadao/types";
import { configManager } from "../managers/config-manager";
import * as timestamp from "./timestamp";
import { getFreeDirectionsAroundStructure } from "./army";

const parkedRealm = {
  game_id: 7,
  entity_id: 42,
  base: { coord_x: 0xffffffff - 3, coord_y: 0xffffffff, alt: false, category: StructureType.Realm },
  metadata: { realm_id: 3 },
};
const site = { col: 25, row: 45 };

const storeWith = (rules: Record<string, unknown>) => {
  const freeHexes = new Set(getLayerNeighborHexes(site.col, site.row, false).map(({ col, row }) => `${col},${row}`));
  return {
    get: (model: string, key: Record<string, unknown>) => {
      if (model === "Structure") return parkedRealm;
      if (model === "TileOpt") return freeHexes.has(`${key.col},${key.row}`) ? { data: 0n } : undefined;
      return rules[model];
    },
    require: (model: string) => {
      if (!(model in rules)) throw new Error(`missing ${model}`);
      return rules[model];
    },
  } as never;
};

describe("getFreeDirectionsAroundStructure", () => {
  afterEach(() => vi.restoreAllMocks());

  it("offers the spawn directions around a Frontier realm's site, where the contract spawns", () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(7);
    vi.spyOn(timestamp, "getBlockTimestamp").mockReturnValue({ currentBlockTimestamp: 86400 * 2 + 10 } as never);
    const store = storeWith({
      SliceRules: { epoch_seconds: 86400 },
      SettlementRules: { spacing: 10 },
      GameRegistry: { start_main_at: 86400n },
    });
    expect(getFreeDirectionsAroundStructure(42, store)).toHaveLength(6);
  });

  it("refuses to look for spawn hexes around the parking coordinate", () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(7);
    expect(() => getFreeDirectionsAroundStructure(42, storeWith({ SliceRules: { epoch_seconds: 0 } }))).toThrow(
      "parked at the expedition sentinel",
    );
  });
});
