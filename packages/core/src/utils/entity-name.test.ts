import { armyName, siteName, StructureType } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";

vi.mock("../managers/config-manager", () => ({ configManager: { getActiveGameId: () => 7 } }));
// A player's own renaming lives in their browser; none here.
vi.stubGlobal("localStorage", { getItem: () => null });

import { getEntityName } from "./entities";

type Rows = Record<string, Record<string, unknown>>;

/** A fact store holding the given rows, keyed by table and entity id, as the client's store answers `get`. */
const storeOf = (rows: Rows) =>
  ({
    get: (table: string, key: { game_id: number; explorer_id?: number; entity_id?: number }) =>
      key.game_id === 7 ? rows[table]?.[String(key.explorer_id ?? key.entity_id)] : undefined,
  }) as never;

const camp = {
  game_id: 7,
  entity_id: 12884901891,
  owner: 1n,
  base: { category: StructureType.Camp, level: 0 },
  metadata: {},
};

describe("the one name a player reads for an army or a structure", () => {
  it("calls an unnamed camp by its map name and an unnamed army by its generated name, never by their entity id", () => {
    const store = storeOf({
      Structure: { "12884901891": camp },
      ExplorerTroops: { "128490": { explorer_id: 128490 } },
    });
    expect(getEntityName(12884901891, store, "blitz")).toBe(siteName(12884901891));
    expect(getEntityName(128490, store, "blitz")).toBe(armyName(128490));
    expect(getEntityName(128490, store, "blitz")).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("keeps a site's proper name in Frontier and Blitz", () => {
    const store = storeOf({ Structure: { "12884901891": camp } });
    expect(getEntityName(12884901891, store, "frontier")).toBe(siteName(12884901891));
    expect(getEntityName(12884901891, store, "frontier")).not.toMatch(/\bcamps?\b/i);
    expect(getEntityName(12884901891, store, "blitz")).toBe(siteName(12884901891));
  });

  it("reads an army's given name", () => {
    const store = storeOf({
      ExplorerTroops: { "5": { explorer_id: 5 } },
      EntityName: { "5": { name: 0x52617665726fn } },
    });
    expect(getEntityName(5, store, "blitz")).toBe("Ravero");
  });

  it("names nothing the store does not hold", () => {
    expect(getEntityName(9, storeOf({}), "blitz")).toBeUndefined();
  });
});
